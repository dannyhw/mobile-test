package dev.mobiletest.driver

import android.content.Intent
import android.graphics.Bitmap
import android.os.SystemClock
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.Configurator
import androidx.test.uiautomator.UiDevice
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

private const val DEFAULT_PORT = 22087
private const val TAG = "MobileTestDriver"

@RunWith(AndroidJUnit4::class)
class DriverServerInstrumentation {

    @Test
    fun startServer() {
        Configurator.getInstance()
            .setActionAcknowledgmentTimeout(0L)
            .setWaitForIdleTimeout(0L)
            .setWaitForSelectorTimeout(0L)

        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val uiDevice = UiDevice.getInstance(instrumentation)
        val port = InstrumentationRegistry.getArguments()
            .getString("port", DEFAULT_PORT.toString())
            .toInt()

        val server = MobileTestHttpServer(port, uiDevice)
        server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
        Log.i(TAG, "Mobile Test Android driver listening on port $port")

        try {
            while (!Thread.currentThread().isInterrupted) {
                Thread.sleep(1_000)
            }
        } finally {
            server.stop()
        }
    }
}

private class MobileTestHttpServer(
    port: Int,
    private val uiDevice: UiDevice,
) : NanoHTTPD(port) {

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val targetContext = instrumentation.targetContext

    override fun serve(session: IHTTPSession): Response {
        return try {
            when {
                session.method == Method.GET && session.uri == "/status" -> jsonResponse(
                    JSONObject().put("status", "ready"),
                )

                session.method == Method.GET && session.uri == "/deviceInfo" -> handleDeviceInfo()
                session.method == Method.GET && session.uri == "/screenshot" -> handleScreenshot()
                session.method == Method.GET && session.uri == "/viewHierarchy" -> handleViewHierarchy()

                session.method == Method.POST && session.uri == "/tap" -> handleTap(parseJsonBody(session))
                session.method == Method.POST && session.uri == "/swipe" -> handleSwipe(parseJsonBody(session))
                session.method == Method.POST && session.uri == "/typeText" -> handleTypeText(parseJsonBody(session))
                session.method == Method.POST && session.uri == "/launchApp" -> handleLaunchApp(parseJsonBody(session))
                session.method == Method.POST && session.uri == "/terminateApp" -> handleTerminateApp(parseJsonBody(session))

                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not found")
            }
        } catch (error: Throwable) {
            Log.e(TAG, "Driver request failed for ${session.method} ${session.uri}", error)
            newFixedLengthResponse(
                Response.Status.INTERNAL_ERROR,
                MIME_PLAINTEXT,
                error.message ?: error::class.java.simpleName,
            )
        }
    }

    private fun handleDeviceInfo(): Response {
        val metrics = targetContext.resources.displayMetrics
        return jsonResponse(
            JSONObject()
                .put("widthPoints", metrics.widthPixels)
                .put("heightPoints", metrics.heightPixels)
                .put("widthPixels", metrics.widthPixels)
                .put("heightPixels", metrics.heightPixels)
                .put("scale", 1),
        )
    }

    private fun handleScreenshot(): Response {
        val bitmap = instrumentation.uiAutomation.takeScreenshot()
            ?: error("UiAutomation.takeScreenshot() returned null")
        val bytes = bitmap.toPng()
        return newFixedLengthResponse(
            Response.Status.OK,
            "image/png",
            ByteArrayInputStream(bytes),
            bytes.size.toLong(),
        )
    }

    private fun handleViewHierarchy(): Response {
        val bytes = dumpViewHierarchyWithRetry()
        return newFixedLengthResponse(
            Response.Status.OK,
            "application/xml",
            ByteArrayInputStream(bytes),
            bytes.size.toLong(),
        )
    }

    private fun handleTap(body: JSONObject): Response {
        val x = body.getDouble("x").roundToInt()
        val y = body.getDouble("y").roundToInt()
        val success = uiDevice.click(x, y)
        if (!success) {
            error("Tap failed at ($x, $y)")
        }
        return emptyResponse()
    }

    private fun handleSwipe(body: JSONObject): Response {
        val startX = body.getDouble("startX").roundToInt()
        val startY = body.getDouble("startY").roundToInt()
        val endX = body.getDouble("endX").roundToInt()
        val endY = body.getDouble("endY").roundToInt()
        val durationSeconds = body.optDouble("duration", 0.35)
        val steps = max(1, (durationSeconds * 200).roundToInt())
        val success = uiDevice.swipe(startX, startY, endX, endY, steps)
        if (!success) {
            error("Swipe failed from ($startX, $startY) to ($endX, $endY)")
        }
        return emptyResponse()
    }

    private fun handleTypeText(body: JSONObject): Response {
        val text = body.optString("text", "")
        if (text.isEmpty()) {
            return emptyResponse()
        }

        for (character in text) {
            typeCharacter(character)
            SystemClock.sleep(50)
        }

        return emptyResponse()
    }

    private fun handleLaunchApp(body: JSONObject): Response {
        val bundleId = body.getString("bundleId")
        val activity = resolveLaunchActivity(bundleId)
        uiDevice.executeShellCommand("am start -W -n $activity")
        return emptyResponse()
    }

    private fun handleTerminateApp(body: JSONObject): Response {
        val bundleId = body.getString("bundleId")
        uiDevice.executeShellCommand("am force-stop $bundleId")
        return emptyResponse()
    }

    private fun typeCharacter(character: Char) {
        val handled = when (character) {
            in '0'..'9' -> uiDevice.pressKeyCode(character.code - 41)
            in 'a'..'z' -> uiDevice.pressKeyCode(character.code - 68)
            in 'A'..'Z' -> uiDevice.pressKeyCode(character.code - 36, android.view.KeyEvent.META_SHIFT_LEFT_ON)
            ' ' -> uiDevice.pressKeyCode(android.view.KeyEvent.KEYCODE_SPACE)
            '\n', '\r' -> uiDevice.pressEnter()
            '.' -> uiDevice.pressKeyCode(android.view.KeyEvent.KEYCODE_PERIOD)
            ',' -> uiDevice.pressKeyCode(android.view.KeyEvent.KEYCODE_COMMA)
            '-' -> uiDevice.pressKeyCode(android.view.KeyEvent.KEYCODE_MINUS)
            '_' -> uiDevice.pressKeyCode(
                android.view.KeyEvent.KEYCODE_MINUS,
                android.view.KeyEvent.META_SHIFT_LEFT_ON,
            )
            '/' -> uiDevice.pressKeyCode(android.view.KeyEvent.KEYCODE_SLASH)
            ':' -> uiDevice.pressKeyCode(
                android.view.KeyEvent.KEYCODE_SEMICOLON,
                android.view.KeyEvent.META_SHIFT_LEFT_ON,
            )
            ';' -> uiDevice.pressKeyCode(android.view.KeyEvent.KEYCODE_SEMICOLON)
            '@' -> uiDevice.pressKeyCode(android.view.KeyEvent.KEYCODE_AT)
            '#' -> uiDevice.pressKeyCode(android.view.KeyEvent.KEYCODE_POUND)
            '\'' -> uiDevice.pressKeyCode(android.view.KeyEvent.KEYCODE_APOSTROPHE)
            '"' -> uiDevice.pressKeyCode(
                android.view.KeyEvent.KEYCODE_APOSTROPHE,
                android.view.KeyEvent.META_SHIFT_LEFT_ON,
            )
            '!' -> uiDevice.pressKeyCode(
                android.view.KeyEvent.KEYCODE_1,
                android.view.KeyEvent.META_SHIFT_LEFT_ON,
            )
            '?' -> uiDevice.pressKeyCode(
                android.view.KeyEvent.KEYCODE_SLASH,
                android.view.KeyEvent.META_SHIFT_LEFT_ON,
            )
            '&' -> uiDevice.pressKeyCode(
                android.view.KeyEvent.KEYCODE_7,
                android.view.KeyEvent.META_SHIFT_LEFT_ON,
            )
            '=' -> uiDevice.pressKeyCode(android.view.KeyEvent.KEYCODE_EQUALS)
            '+' -> uiDevice.pressKeyCode(
                android.view.KeyEvent.KEYCODE_EQUALS,
                android.view.KeyEvent.META_SHIFT_LEFT_ON,
            )
            else -> false
        }

        if (!handled) {
            val escaped = escapeForInputText(character.toString())
            uiDevice.executeShellCommand("input text $escaped")
        }
    }

    private fun dumpViewHierarchyWithRetry(retriesRemaining: Int = 1): ByteArray {
        return try {
            AndroidViewHierarchy.dump(uiDevice, instrumentation.uiAutomation)
        } catch (error: Throwable) {
            if (retriesRemaining <= 0) {
                throw error
            }

            Log.w(TAG, "Retrying Android hierarchy dump after failure", error)
            SystemClock.sleep(500)
            dumpViewHierarchyWithRetry(retriesRemaining - 1)
        }
    }

    private fun parseJsonBody(session: IHTTPSession): JSONObject {
        val files = mutableMapOf<String, String>()
        session.parseBody(files)
        val body = files["postData"].orEmpty()
        if (body.isBlank()) {
            return JSONObject()
        }
        return JSONObject(body)
    }

    private fun jsonResponse(json: JSONObject): Response {
        return newFixedLengthResponse(Response.Status.OK, "application/json", json.toString())
    }

    private fun emptyResponse(): Response {
        return newFixedLengthResponse(Response.Status.OK, MIME_PLAINTEXT, "")
    }

    private fun escapeForInputText(text: String): String {
        return buildString {
            text.forEach { character ->
                when (character) {
                    ' ' -> append("%s")
                    '&', '|', '<', '>', '(', ')', ';', '*', '\\', '"', '\'' -> {
                        append('\\')
                        append(character)
                    }
                    else -> append(character)
                }
            }
        }
    }

    private fun resolveLaunchActivity(bundleId: String): String {
        val output = uiDevice.executeShellCommand("cmd package resolve-activity --brief $bundleId")
        val lines = output
            .lineSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toList()

        for (index in lines.indices.reversed()) {
            val line = lines[index]
            if (line.contains('/')) {
                return line
            }
        }

        error("No launcher activity found for package $bundleId")
    }
}

private fun Bitmap.toPng(): ByteArray {
    val stream = ByteArrayOutputStream()
    if (!compress(Bitmap.CompressFormat.PNG, 100, stream)) {
        error("Failed to encode screenshot as PNG")
    }
    return stream.toByteArray()
}
