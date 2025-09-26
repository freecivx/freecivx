/* Copyright (C) The Authors 2025 */
package net.freecivx.data;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.InputStream;
import org.junit.jupiter.api.Test;

public class SectionFileTest {

  private static final String RULESET = "english.ruleset";

  @Test
  public void testRuleset() throws IOException {
    try (InputStream is = ClassLoader.getSystemClassLoader().getResourceAsStream(RULESET)) {
      var sf = SectionFile.fromInputStream(is, "nation_english", true);
      assertEquals(1, sf.getSections().size());
    }
  }
}
