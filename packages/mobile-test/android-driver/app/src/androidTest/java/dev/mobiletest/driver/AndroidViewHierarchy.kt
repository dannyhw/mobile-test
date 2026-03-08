package dev.mobiletest.driver

import android.app.UiAutomation
import android.content.Context
import android.graphics.Rect
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import android.util.Xml
import android.view.WindowManager
import android.view.accessibility.AccessibilityNodeInfo
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.xmlpull.v1.XmlSerializer
import java.io.ByteArrayOutputStream
import java.io.IOException

private const val HIERARCHY_TAG = "MobileTestHierarchy"

object AndroidViewHierarchy {

    fun dump(device: UiDevice, uiAutomation: UiAutomation): ByteArray {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val windowManager = instrumentation.context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val displayRect = resolveDisplayRect(windowManager)
        val serializerOutput = ByteArrayOutputStream()
        val serializer = Xml.newSerializer()

        serializer.setFeature("http://xmlpull.org/v1/doc/features.html#indent-output", true)
        serializer.setOutput(serializerOutput, "UTF-8")
        serializer.startDocument("UTF-8", true)
        serializer.startTag("", "hierarchy")
        serializer.attribute("", "rotation", device.displayRotation.toString())

        resolveRoots(device, uiAutomation).forEachIndexed { index, root ->
            dumpNode(serializer, root, index, displayRect, insideWebView = false)
        }

        serializer.endTag("", "hierarchy")
        serializer.endDocument()
        serializer.flush()

        return serializerOutput.toByteArray()
    }

    private fun resolveDisplayRect(windowManager: WindowManager): Rect {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return windowManager.currentWindowMetrics.bounds
        }

        val displayMetrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        windowManager.defaultDisplay.getRealMetrics(displayMetrics)
        return Rect(0, 0, displayMetrics.widthPixels, displayMetrics.heightPixels)
    }

    private fun resolveRoots(device: UiDevice, uiAutomation: UiAutomation): List<AccessibilityNodeInfo> {
        return try {
            device.javaClass
                .getDeclaredMethod("getWindowRoots")
                .apply { isAccessible = true }
                .invoke(device)
                .let {
                    @Suppress("UNCHECKED_CAST")
                    it as Array<AccessibilityNodeInfo>
                }
                .toList()
        } catch (error: Throwable) {
            Log.w(HIERARCHY_TAG, "Falling back to rootInActiveWindow", error)
            listOfNotNull(uiAutomation.rootInActiveWindow)
        }
    }

    @Throws(IOException::class)
    private fun dumpNode(
        serializer: XmlSerializer,
        node: AccessibilityNodeInfo,
        index: Int,
        displayRect: Rect,
        insideWebView: Boolean,
    ) {
        serializer.startTag("", "node")
        serializer.attribute("", "index", index.toString())
        serializer.attribute("", "text", safeString(node.text))
        serializer.attribute("", "resource-id", safeString(node.viewIdResourceName))
        serializer.attribute("", "class", safeString(node.className))
        serializer.attribute("", "package", safeString(node.packageName))
        serializer.attribute("", "content-desc", safeString(node.contentDescription))
        serializer.attribute("", "hintText", safeString(node.hintText))
        serializer.attribute("", "checkable", node.isCheckable.toString())
        serializer.attribute("", "checked", node.isChecked.toString())
        serializer.attribute("", "clickable", node.isClickable.toString())
        serializer.attribute("", "enabled", node.isEnabled.toString())
        serializer.attribute("", "focusable", node.isFocusable.toString())
        serializer.attribute("", "focused", node.isFocused.toString())
        serializer.attribute("", "scrollable", node.isScrollable.toString())
        serializer.attribute("", "long-clickable", node.isLongClickable.toString())
        serializer.attribute("", "password", node.isPassword.toString())
        serializer.attribute("", "selected", node.isSelected.toString())
        serializer.attribute("", "visible-to-user", node.isVisibleToUser.toString())
        serializer.attribute("", "bounds", visibleBounds(node, displayRect)?.toShortString().orEmpty())

        repeat(node.childCount) { childIndex ->
            val child = node.getChild(childIndex)
            if (child == null) {
                Log.i(HIERARCHY_TAG, "Null child $childIndex/${node.childCount} for node=$node")
                return@repeat
            }

            try {
                if (child.isVisibleToUser || insideWebView) {
                    dumpNode(
                        serializer = serializer,
                        node = child,
                        index = childIndex,
                        displayRect = displayRect,
                        insideWebView = insideWebView || child.className == "android.webkit.WebView",
                    )
                }
            } finally {
                @Suppress("DEPRECATION")
                child.recycle()
            }
        }

        serializer.endTag("", "node")
    }

    private fun safeString(value: CharSequence?): String {
        if (value == null) {
            return ""
        }

        return buildString(value.length) {
            value.forEach { character ->
                if (
                    character.code == 0x9 ||
                    character.code == 0xA ||
                    character.code == 0xD ||
                    character.code in 0x20..0xD7FF ||
                    character.code in 0xE000..0xFFFD
                ) {
                    append(character)
                }
            }
        }
    }

    private fun visibleBounds(node: AccessibilityNodeInfo, displayRect: Rect): Rect? {
        val bounds = Rect()
        node.getBoundsInScreen(bounds)
        if (bounds.isEmpty) {
            return null
        }

        if (!bounds.intersect(displayRect)) {
            return null
        }

        return bounds
    }
}
