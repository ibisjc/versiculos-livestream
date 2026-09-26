import { Bible, VerseReference } from "../types";

export default function getVerseByReference(bible: Bible, reference: VerseReference | null) {
    if(!reference) {
        return null
    }

    const book = bible.find(({abbrev}) => abbrev === reference.book)

    if(!book) return null

    const verse = ((book.chapters[reference.chapter-1] ?? [])[reference.verse-1]) ?? null

    if (!verse) {
        return null
    }

    return verse
        .replaceAll('', ' ')
}