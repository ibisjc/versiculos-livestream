import { Bible, VerseReference } from "../types";


export default function getAdjacentVerse(
  bible: Bible,
  ref: VerseReference,
  direction: 'prev' | 'next'
): VerseReference | null {
  const bookIndex = bible.findIndex(b => b.abbrev === ref.book);
  if (bookIndex === -1) return null;

  const book = bible[bookIndex];
  // chapter e verse são 1-indexados; os arrays são 0-indexados
  const chapterIndex = ref.chapter - 1;
  const verseIndex = ref.verse - 1;

  if (chapterIndex < 0 || chapterIndex >= book.chapters.length) return null;
  const chapter = book.chapters[chapterIndex];
  if (verseIndex < 0 || verseIndex >= chapter.length) return null;

  if (direction === 'next') {
    // ainda há versículo no mesmo capítulo
    if (verseIndex + 1 < chapter.length) {
      return { book: ref.book, chapter: ref.chapter, verse: ref.verse + 1 };
    }
    // próximo capítulo do mesmo livro
    if (chapterIndex + 1 < book.chapters.length) {
      return { book: ref.book, chapter: ref.chapter + 1, verse: 1 };
    }
    // primeiro capítulo/versículo do próximo livro
    if (bookIndex + 1 < bible.length) {
      const nextBook = bible[bookIndex + 1];
      if (nextBook.chapters.length > 0 && nextBook.chapters[0].length > 0) {
        return { book: nextBook.abbrev, chapter: 1, verse: 1 };
      }
    }
    return null; // fim da Bíblia
  } else {
    // direction === 'prev'
    // ainda há versículo anterior no mesmo capítulo
    if (verseIndex - 1 >= 0) {
      return { book: ref.book, chapter: ref.chapter, verse: ref.verse - 1 };
    }
    // capítulo anterior do mesmo livro
    if (chapterIndex - 1 >= 0) {
      const prevChapter = book.chapters[chapterIndex - 1];
      return {
        book: ref.book,
        chapter: ref.chapter - 1,
        verse: prevChapter.length,
      };
    }
    // último capítulo/versículo do livro anterior
    if (bookIndex - 1 >= 0) {
      const prevBook = bible[bookIndex - 1];
      const lastChapterIndex = prevBook.chapters.length - 1;
      if (lastChapterIndex >= 0) {
        const lastChapter = prevBook.chapters[lastChapterIndex];
        return {
          book: prevBook.abbrev,
          chapter: lastChapterIndex + 1,
          verse: lastChapter.length,
        };
      }
    }
    return null; // início da Bíblia
  }
}