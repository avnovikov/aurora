package com.aurora.rassvet.secure;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import org.junit.Test;

public class SecureEnvelopeTest {
  @Test
  public void roundTripsPlaintext() {
    SecretKey key = TestKeys.softwareAes256();
    byte[] plaintext = "bodyweightKg:78".getBytes(StandardCharsets.UTF_8);
    byte[] sealed = SecureEnvelope.seal(key, plaintext);
    byte[] opened = SecureEnvelope.open(key, sealed);
    assertArrayEquals(plaintext, opened);
  }

  @Test
  public void rejectsTamperedCiphertext() {
    SecretKey key = TestKeys.softwareAes256();
    byte[] sealed = SecureEnvelope.seal(key, new byte[] {1, 2, 3});
    sealed[sealed.length - 1] ^= 0x01;
    IllegalStateException error =
        assertThrows(IllegalStateException.class, () -> SecureEnvelope.open(key, sealed));
    assertEquals("Failed to open envelope (tampered or wrong key)", error.getMessage());
  }

  @Test
  public void eachSealUsesAFreshTwelveByteIv() {
    SecretKey key = TestKeys.softwareAes256();
    byte[] a = SecureEnvelope.seal(key, new byte[] {7});
    byte[] b = SecureEnvelope.seal(key, new byte[] {7});
    assertEquals(1 + SecureEnvelope.IV_LENGTH_BYTES + 1 + SecureEnvelope.TAG_LENGTH_BYTES, a.length);
    org.junit.Assert.assertFalse(java.util.Arrays.equals(
        java.util.Arrays.copyOfRange(a, 1, 1 + SecureEnvelope.IV_LENGTH_BYTES),
        java.util.Arrays.copyOfRange(b, 1, 1 + SecureEnvelope.IV_LENGTH_BYTES)));
  }

  @Test
  public void rejectsWrongKey() {
    byte[] sealed = SecureEnvelope.seal(TestKeys.softwareAes256(), new byte[] {9});
    assertThrows(
        IllegalStateException.class, () -> SecureEnvelope.open(TestKeys.softwareAes256(), sealed));
  }
}
