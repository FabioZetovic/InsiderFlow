package com.insiderflow.trades;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Exercises name canonicalization against the real bundled legislators.json (no Spring, no
 * Mongo — MemberDirectory only needs Jackson).
 */
class MemberDirectoryTest {

    private static MemberDirectory directory;

    @BeforeAll
    static void load() {
        directory = new MemberDirectory(new ObjectMapper());
        directory.load();
    }

    @Test
    void resolvesExactCanonicalName() {
        MemberDirectory.MemberInfo info = directory.resolve("Nancy Pelosi");
        assertNotNull(info);
        assertEquals("Nancy Pelosi", info.canonical());
        assertEquals("Democrat", info.party());
        assertEquals("California", info.state());
    }

    @Test
    void unifiesEfdAndMirrorSpellings() {
        // eFD scraper says "Shelley M Capito", the old mirror "Shelley Moore Capito".
        MemberDirectory.MemberInfo efd = directory.resolve("Shelley M Capito");
        MemberDirectory.MemberInfo mirror = directory.resolve("Shelley Moore Capito");
        assertNotNull(efd);
        assertNotNull(mirror);
        assertEquals(efd.canonical(), mirror.canonical());
        assertEquals("Republican", efd.party());
    }

    @Test
    void handlesHonorificsAndSuffixes() {
        MemberDirectory.MemberInfo info = directory.resolve("Hon. Nancy Pelosi");
        assertNotNull(info);
        assertEquals("Nancy Pelosi", info.canonical());
    }

    @Test
    void handlesLastFirstOrdering() {
        MemberDirectory.MemberInfo info = directory.resolve("Pelosi, Nancy");
        assertNotNull(info);
        assertEquals("Nancy Pelosi", info.canonical());
    }

    @Test
    void returnsNullForUnknownNames() {
        assertNull(directory.resolve("Definitely Not A Legislator"));
        assertNull(directory.resolve(""));
        assertNull(directory.resolve(null));
    }
}
