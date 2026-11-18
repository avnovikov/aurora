package com.aurora.alvorada.secure;

import android.content.Context;
import java.io.File;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;

/**
 * One encrypted file per storage key under the app's private files directory.
 */
public final class SecureValueStore {
  private final ContentKeyVault vault;
  private final File valuesDir;

  public SecureValueStore(Context context) {
    this(new ContentKeyVault(context));
  }

  SecureValueStore(ContentKeyVault vault) {
    this.vault = vault;
    this.valuesDir = new File(vault.vaultDir(), "values");
    StorageKeyFiles.ensureDir(valuesDir);
  }

  public synchronized String getItem(String key) {
    StorageKeyFiles.assertStorageKey(key);
    File file = valueFile(key);
    if (!file.exists()) {
      return null;
    }
    byte[] plaintext =
        SecureEnvelope.open(vault.contentKey(), StorageKeyFiles.readAll(file));
    return new String(plaintext, StandardCharsets.UTF_8);
  }

  public synchronized void setItem(String key, String value) {
    StorageKeyFiles.assertStorageKey(key);
    if (value == null) {
      throw new IllegalArgumentException("value must not be null");
    }
    byte[] sealed =
        SecureEnvelope.seal(vault.contentKey(), value.getBytes(StandardCharsets.UTF_8));
    StorageKeyFiles.writeAll(valueFile(key), sealed);
  }

  public synchronized void removeItem(String key) {
    StorageKeyFiles.assertStorageKey(key);
    File file = valueFile(key);
    if (file.exists() && !file.delete()) {
      throw new IllegalStateException("Failed to delete " + file);
    }
  }

  private File valueFile(String key) {
    return new File(valuesDir, StorageKeyFiles.fileNameForKey(key));
  }

  /** Test helper: build a store with an injected content key vault. */
  static SecureValueStore forTesting(File vaultDir, SecretKey wrappingKey) {
    return new SecureValueStore(new ContentKeyVault(vaultDir, wrappingKey, true));
  }
}
