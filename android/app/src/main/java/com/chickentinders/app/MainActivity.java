package com.chickentinders.app;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private Insets lastSystemBars = Insets.NONE;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Render behind the status / nav bars (matches StatusBar.setOverlaysWebView(true))
        // but expose the real inset heights to CSS so pages can pad around them.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WebView webView = bridge.getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            lastSystemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            applyInsetCssVars();
            return insets;
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        // First inset dispatch can land before the document parses; re-apply
        // once the activity is fully visible.
        applyInsetCssVars();
    }

    private void applyInsetCssVars() {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) return;
        float density = getResources().getDisplayMetrics().density;
        String js = String.format(Locale.US,
            "(function apply(){var r=document.documentElement;" +
            "if(!r){setTimeout(apply,50);return;}" +
            "r.style.setProperty('--android-safe-top','%.2fpx');" +
            "r.style.setProperty('--android-safe-bottom','%.2fpx');" +
            "r.style.setProperty('--android-safe-left','%.2fpx');" +
            "r.style.setProperty('--android-safe-right','%.2fpx');})();",
            lastSystemBars.top / density,
            lastSystemBars.bottom / density,
            lastSystemBars.left / density,
            lastSystemBars.right / density);
        webView.evaluateJavascript(js, null);
    }
}
