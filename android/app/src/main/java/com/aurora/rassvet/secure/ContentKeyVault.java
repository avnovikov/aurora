package com.aurora.rassvet.secure;

import android.content.Context;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.io.File;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.SecureRandom;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

/**
 * Holds the content key used for value files. The wrapping key lives in the
 * Android Keystore and never leaves the device. Existing ciphertext is never
 * overwritten with a freshly minted wrapping key.
 */
public final class ContentKeyVault {
  static final String KEYSTORE_ALIAS = "aurora.secure.wrap.v1";
  static final String CONTENT_KEY_FILE = "content_key.enc";
  private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
  private static final int CONTENT_KEY_BYTES = 32;

  private final File vaultDir;
  private final SecretKey contentKey;

  public ContentKeyVault(Context context) {
    this(new File(context.getFilesDir(), "aurora_secure"), true);
  }

  /** Package-private for tests that inject a software wrapping key. */
  ContentKeyVault(File vaultDir, SecretKey wrappingKey, boolean createIfMissing) {
    this.vaultDir = vaultDir;
    StorageKeyFiles.ensureDir(vaultDir);
    this.contentKey = loadOrCreateContentKey(wrappingKey, createIfMissing);
  }

  private ContentKeyVault(File vaultDir, boolean createIfMissing) {
    this.vaultDir = vaultDir;
    StorageKeyFiles.ensureDir(vaultDir);
    SecretKey wrappingKey = loadOrCreateWrappingKey(hasAnyCiphertext());
    this.contentKey = loadOrCreateContentKey(wrappingKey, createIfMissing);
  }

  SecretKey contentKey() {
    return contentKey;
  }

  File vaultDir() {
    return vaultDir;
  }

  private SecretKey loadOrCreateContentKey(SecretKey wrappingKey, boolean createIfMissing) {
    File contentKeyFile = new File(vaultDir, CONTENT_KEY_FILE);
    if (contentKeyFile.exists()) {
      return unwrapContentKey(wrappingKey, contentKeyFile);
    }
    if (hasValueFiles()) {
      throw new IllegalStateException(
          "Encrypted values exist but the content key file is missing");
    }
    if (!createIfMissing) {
      throw new IllegalStateException("Content key is missing");
    }
    return mintContentKey(wrappingKey, contentKeyFile);
  }

  private static SecretKey unwrapContentKey(SecretKey wrappingKey, File contentKeyFile) {
    byte[] raw = SecureEnvelope.open(wrappingKey, StorageKeyFiles.readAll(contentKeyFile));
    if (raw.length != CONTENT_KEY_BYTES) {
      throw new IllegalStateException(
          "Content key length must be " + CONTENT_KEY_BYTES + "; got " + raw.length);
    }
    return new SecretKeySpec(raw, "AES");
  }

  private static SecretKey mintContentKey(SecretKey wrappingKey, File contentKeyFile) {
    byte[] raw = new byte[CONTENT_KEY_BYTES];
    new SecureRandom().nextBytes(raw);
    StorageKeyFiles.writeAll(contentKeyFile, SecureEnvelope.seal(wrappingKey, raw));
    return new SecretKeySpec(raw, "AES");
  }

  private SecretKey loadOrCreateWrappingKey(boolean ciphertextExists) {
    try {
      KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
      keyStore.load(null);
      if (keyStore.containsAlias(KEYSTORE_ALIAS)) {
        return existingWrappingKey(keyStore);
      }
      if (ciphertextExists) {
        throw new IllegalStateException(
            "Encrypted data exists but the Keystore wrapping key is missing");
      }
      return createWrappingKey();
    } catch (GeneralSecurityException | IOException e) {
      throw new IllegalStateException("Failed to load Keystore wrapping key", e);
    }
  }

  private static SecretKey existingWrappingKey(KeyStore keyStore)
      throws GeneralSecurityException {
    KeyStore.SecretKeyEntry entry =
        (KeyStore.SecretKeyEntry) keyStore.getEntry(KEYSTORE_ALIAS, null);
    if (entry == null) {
      throw new IllegalStateException("Keystore alias exists without a secret key");
    }
    return entry.getSecretKey();
  }

  private static SecretKey createWrappingKey() throws GeneralSecurityException {
    KeyGenerator keyGenerator =
        KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
    KeyGenParameterSpec.Builder builder =
        new KeyGenParameterSpec.Builder(
                KEYSTORE_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      builder.setUnlockedDeviceRequired(true);
    }
    keyGenerator.init(builder.build());
    return keyGenerator.generateKey();
  }

  private boolean hasAnyCiphertext() {
    File contentKeyFile = new File(vaultDir, CONTENT_KEY_FILE);
    return contentKeyFile.exists() || hasValueFiles();
  }

  private boolean hasValueFiles() {
    File values = new File(vaultDir, "values");
    File[] files = values.listFiles();
    return files != null && files.length > 0;
  }
}
