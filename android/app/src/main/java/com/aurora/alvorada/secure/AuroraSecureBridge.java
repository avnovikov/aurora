package com.aurora.alvorada.secure;

import android.webkit.JavascriptInterface;

/**
 * Synchronous WebView bridge. Exposed as {@code window.AuroraSecure}.
 */
public final class AuroraSecureBridge {
  private final SecureValueStore store;

  public AuroraSecureBridge(SecureValueStore store) {
    if (store == null) {
      throw new IllegalArgumentException("store must not be null");
    }
    this.store = store;
  }

  @JavascriptInterface
  public String getItem(String key) {
    return store.getItem(key);
  }

  @JavascriptInterface
  public void setItem(String key, String value) {
    store.setItem(key, value);
  }

  @JavascriptInterface
  public void removeItem(String key) {
    store.removeItem(key);
  }
}
