package com.aurora.rassvet.secure;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;

/**
 * Storage-key validation, hashed file names, and vault file I/O.
 * Kept separate from {@link ContentKeyVault} so key wrapping stays one job.
 */
final class StorageKeyFiles {
  private StorageKeyFiles() {}

  static void assertStorageKey(String key) {
    if (key == null || key.isEmpty()) {
      throw new IllegalArgumentException("storage key must be non-empty");
    }
    if (key.indexOf('/') >= 0 || key.indexOf('\\') >= 0 || key.indexOf('\0') >= 0) {
      throw new IllegalArgumentException("storage key contains illegal characters");
    }
  }

  static String fileNameForKey(String key) {
    assertStorageKey(key);
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(key.getBytes(StandardCharsets.UTF_8));
      return toHex(hash) + ".bin";
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }

  static void ensureDir(File dir) {
    if (!dir.exists() && !dir.mkdirs()) {
      throw new IllegalStateException("Cannot create directory: " + dir);
    }
  }

  static byte[] readAll(File file) {
    try {
      return Files.readAllBytes(file.toPath());
    } catch (IOException e) {
      throw new IllegalStateException("Failed to read " + file, e);
    }
  }

  static void writeAll(File file, byte[] bytes) {
    try {
      File parent = file.getParentFile();
      if (parent != null) {
        ensureDir(parent);
      }
      Files.write(file.toPath(), bytes);
    } catch (IOException e) {
      throw new IllegalStateException("Failed to write " + file, e);
    }
  }

  private static String toHex(byte[] bytes) {
    StringBuilder hex = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) {
      hex.append(String.format("%02x", b));
    }
    return hex.toString();
  }
}
