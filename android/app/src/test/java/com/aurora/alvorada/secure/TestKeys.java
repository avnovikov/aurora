package com.aurora.alvorada.secure;

import java.security.SecureRandom;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

/** Shared AES test keys for JVM unit tests (no Android Keystore). */
final class TestKeys {
  private TestKeys() {}

  static SecretKey softwareAes256() {
    byte[] raw = new byte[32];
    new SecureRandom().nextBytes(raw);
    return new SecretKeySpec(raw, "AES");
  }
}
