package com.aurora.rassvet.secure;

import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * AES-GCM envelope: version | iv | ciphertext+tag.
 * The SecretKey is injected so JVM tests can use a software key.
 */
public final class SecureEnvelope {
  public static final int VERSION = 1;
  public static final int IV_LENGTH_BYTES = 12;
  public static final int TAG_LENGTH_BITS = 128;
  public static final int TAG_LENGTH_BYTES = TAG_LENGTH_BITS / 8;

  private static final int MIN_SEALED_LENGTH = 1 + IV_LENGTH_BYTES + TAG_LENGTH_BYTES;
  private static final SecureRandom RANDOM = new SecureRandom();

  private SecureEnvelope() {}

  public static byte[] seal(SecretKey key, byte[] plaintext) {
    requireNonNull(key, "key");
    requireNonNull(plaintext, "plaintext");
    try {
      // The cipher picks the IV: Android Keystore keys with randomized encryption
      // required reject a caller-provided IV ("Caller-provided IV not permitted").
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, RANDOM);
      byte[] iv = cipher.getIV();
      if (iv == null || iv.length != IV_LENGTH_BYTES) {
        throw new IllegalStateException(
            "Unexpected GCM IV length: " + (iv == null ? "none" : iv.length));
      }
      byte[] ciphertext = cipher.doFinal(plaintext);
      ByteBuffer buffer = ByteBuffer.allocate(1 + IV_LENGTH_BYTES + ciphertext.length);
      buffer.put((byte) VERSION);
      buffer.put(iv);
      buffer.put(ciphertext);
      return buffer.array();
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("Failed to seal envelope", e);
    }
  }

  public static byte[] open(SecretKey key, byte[] sealed) {
    requireNonNull(key, "key");
    requireNonNull(sealed, "sealed");
    if (sealed.length < MIN_SEALED_LENGTH) {
      throw new IllegalStateException("Sealed blob is too short");
    }
    ByteBuffer buffer = ByteBuffer.wrap(sealed);
    int version = buffer.get() & 0xff;
    if (version != VERSION) {
      throw new IllegalStateException("Unsupported envelope version: " + version);
    }
    byte[] iv = new byte[IV_LENGTH_BYTES];
    buffer.get(iv);
    byte[] ciphertext = new byte[buffer.remaining()];
    buffer.get(ciphertext);
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
      return cipher.doFinal(ciphertext);
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("Failed to open envelope (tampered or wrong key)", e);
    }
  }

  private static void requireNonNull(Object value, String name) {
    if (value == null) {
      throw new IllegalArgumentException(name + " must not be null");
    }
  }
}
