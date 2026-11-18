package com.aurora.rassvet;

import android.os.Bundle;
import android.webkit.WebView;
import com.aurora.rassvet.secure.AuroraSecureBridge;
import com.aurora.rassvet.secure.SecureValueStore;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    SecureValueStore store = new SecureValueStore(this);
    AuroraSecureBridge bridge = new AuroraSecureBridge(store);
    WebView webView = this.bridge.getWebView();
    if (webView == null) {
      throw new IllegalStateException("Capacitor WebView is missing; cannot attach AuroraSecure");
    }
    webView.addJavascriptInterface(bridge, "AuroraSecure");
  }
}
