package com.aurora.rassvet.secure;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;

import java.io.File;
import javax.crypto.SecretKey;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class SecureValueStoreTest {
  @Rule public TemporaryFolder folder = new TemporaryFolder();

  @Test
  public void roundTripsStringValues() throws Exception {
    File vault = folder.newFolder("vault");
    SecureValueStore store = SecureValueStore.forTesting(vault, TestKeys.softwareAes256());
    store.setItem("aurora.poc.profile.v1", "{\"bodyweightKg\":78}");
    assertEquals("{\"bodyweightKg\":78}", store.getItem("aurora.poc.profile.v1"));
    store.removeItem("aurora.poc.profile.v1");
    assertNull(store.getItem("aurora.poc.profile.v1"));
  }

  @Test
  public void rejectsTamperedValueFile() throws Exception {
    File vault = folder.newFolder("vault2");
    SecretKey wrapping = TestKeys.softwareAes256();
    SecureValueStore store = SecureValueStore.forTesting(vault, wrapping);
    store.setItem("aurora.poc.history.v1", "[]");
    File values = new File(vault, "values");
    File[] files = values.listFiles();
    assertEquals(1, files.length);
    byte[] sealed = StorageKeyFiles.readAll(files[0]);
    sealed[sealed.length - 1] ^= 0x5a;
    StorageKeyFiles.writeAll(files[0], sealed);
    assertThrows(IllegalStateException.class, () -> store.getItem("aurora.poc.history.v1"));
  }
}
