import { describe, expect, it } from "vitest";
import { decodedPath, foundInWork, isMachineTranslation, looksEnglish, parseCommentaryToml, refsFromFilename, toSourceRow, workText } from "@/lib/sources/patristic";

const URL_ON_JOHN = "https://historicalchristian.faith/by_father.php?file=John%2520Chrysostom%2FHomilies%2FOn%2520John%2FHomily%252027.html";
const PD_PAGE = "<article><i>[Translated by Ph. Schaff]</i><p>What He saith, is of this kind: Marvel not that I am to be lifted up that ye may be saved, for this seemeth good to the Father, and He hath so loved you as to give His Son for slaves, and ungrateful slaves.</p></article>";

describe("commentary files", () => {
  it("reads the TOML subset with multi-line quotes", () => {
    const toml = `[[commentary]]\nquote='''\nFirst line.\n\nSecond line.\n'''\nsource_url='https://x.org/a'\nsource_title="Homily 27"\n\n[[commentary]]\nquote="""A "quoted" word"""\nsource_url=''\n`;
    const entries = parseCommentaryToml(toml)!;
    expect(entries).toHaveLength(2);
    expect(entries[0]!.quote).toBe("First line.\n\nSecond line.\n");
    expect(entries[0]!.source_title).toBe("Homily 27");
    expect(entries[1]!.quote).toBe('A "quoted" word');
    expect(parseCommentaryToml("[[commentary]]\nquote = [1, 2]\n")).toBeNull();
  });

  it("turns file names into verse keys (NT only)", () => {
    expect(refsFromFilename("John 3_16.toml")).toEqual(["JHN 3:16"]);
    expect(refsFromFilename("1 Corinthians 13_4-7.toml")).toEqual(["1CO 13:4", "1CO 13:5", "1CO 13:6", "1CO 13:7"]);
    expect(refsFromFilename("Matthew 26_74-27_2.toml")).toEqual(["MAT 26:74", "MAT 26:75", "MAT 26:76", "MAT 26:77", "MAT 26:78", "MAT 26:79", "MAT 26:80", "MAT 27:1", "MAT 27:2"]);
    expect(refsFromFilename("Genesis 1_1.toml")).toBeNull();
    expect(refsFromFilename("Psalms 23_1.toml")).toBeNull();
  });

  it("decodes the doubly-encoded work path", () => {
    expect(decodedPath(URL_ON_JOHN)).toBe("John Chrysostom/Homilies/On John/Homily 27.html");
    expect(decodedPath("https://archive.org/details/x")).toBeNull();
  });
});

describe("provenance checks", () => {
  const work = workText(PD_PAGE);
  const entry = (quote: string, url = URL_ON_JOHN) => ({ quote, source_url: url, source_title: "Homily on the Gospel of John 27", append_to_author_name: "" });

  it("accepts an excerpt found word for word in the public-domain work", () => {
    const v = toSourceRow("John Chrysostom", "John 3_16.toml", entry("He hath so loved you as to give His Son for slaves, and ungrateful slaves."), "east", () => work);
    expect("row" in v && v.row).toMatchObject({ author: "John Chrysostom", work: "Homilies On John", section: "Homily 27", verified: true, region: "east", bible_refs: ["JHN 3:16"] });
  });

  it("rejects an excerpt that is not in the public-domain text (modern translation)", () => {
    const v = toSourceRow("John Chrysostom", "John 3_16.toml", entry("God loved you so much that he gave his Son even for ungrateful servants, which no man would do."), "east", () => work);
    expect(v).toEqual({ skip: "not_in_public_domain_text" });
  });

  it("rejects works outside the public-domain list and machine translations", () => {
    const modern = "https://historicalchristian.faith/by_father.php?file=Jerome%2FCommentary%2520on%2520Matthew.html";
    expect(toSourceRow("Jerome", "Matthew 5_3.toml", entry("And He hath so loved you as to give His Son for slaves and ungrateful slaves.", modern), null, () => work)).toEqual({ skip: "not_public_domain" });
    expect(isMachineTranslation("<i>[Translated from Migne via ChatGPT]</i>")).toBe(true);
    expect(isMachineTranslation(PD_PAGE)).toBe(false);
  });

  it("checks every paragraph, ignoring Catena Aurea reference prefixes", () => {
    const page = workText("<p>The Greek word logos signifies both Word and Reason in this passage.</p><p>Words by their daily use have become common things to us all.</p>");
    expect(foundInWork("(lib. lxxxiii. Quæst. q. 63) The Greek word logos signifies both Word and Reason in this passage.\n\n(Tract. i. c. 8) Words by their daily use have become common things to us all.", page)).toBe(true);
    expect(foundInWork("The Greek word logos signifies both Word and Reason in this passage.\n\nAn invented second paragraph that is nowhere in the text.", page)).toBe(false);
  });

  it("detects English text", () => {
    expect(looksEnglish("And the Word was with God, and he is the light of the world for all of them.")).toBe(true);
    expect(looksEnglish("Au commencement était la Parole et la Parole était avec Dieu.")).toBe(false);
  });
});
