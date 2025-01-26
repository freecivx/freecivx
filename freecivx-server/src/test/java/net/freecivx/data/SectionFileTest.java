package net.freecivx.data;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class SectionFileTest {

    private static final String RULESET = "english.ruleset";

    @Test
    public void testRuleset() throws IOException {
        try (InputStream is = ClassLoader.getSystemClassLoader().getResourceAsStream(RULESET)) {
            var sf = SectionFile.fromInputStream(is, "nation_english", true);
            assertEquals(3, sf.getSections().size());
        }

    }

}
