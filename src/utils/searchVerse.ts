import { Bible, BookAbbr, VerseReference } from "../types"
import { BOOK_TO_ABBR } from "../constants"
import * as fuzz from "fuzzball"

const SEARCH_MATCHER = /([0-9]*\s*[A-zà-ú]*)\s*([0-9]+){0,1}[:\s]*([0-9]+){0,1}/i

const MAX_SUGGESTIONS = 10
const BOOK_MATCH_THRESHOLD = 45      // score mínimo (0-100) p/ considerar candidato via fuzzy fallback
const AMBIGUITY_MARGIN = 8           // diferença máxima de score p/ dois livros serem considerados "empatados"
const SEQUENTIAL_FALLBACK_LIMIT = 50 // tentativas de versículo por livro na sequência sintética

type ScoredBook = { abbr: BookAbbr; score: number }

// Pré-computa as chaves de BOOK_TO_ABBR já normalizadas (sem acento/espaço), uma única vez
const FOLDED_ENTRIES = Object.entries(BOOK_TO_ABBR).map(([key, abbr]) => ({
    key,
    abbr,
    folded: normalizeText(key),
}))

export default function searchVerse(
    searchTerm: string,
    bible: Bible,
    history: Array<VerseReference>
): Array<VerseReference> {
    const bibleByAbbr = new Map(bible.map((book) => [book.abbrev, book]))

    // --- Helpers de existência real (livro/capítulo/versículo) --------------
    function verseCount(abbr: BookAbbr, chapter: number): number {
        if (chapter < 1) return 0
        const chapters = bibleByAbbr.get(abbr)?.chapters
        return chapters?.[chapter - 1]?.length ?? 0
    }

    function referenceExists(ref: VerseReference): boolean {
        return ref.verse >= 1 && ref.verse <= verseCount(ref.book, ref.chapter)
    }

    const match = searchTerm.match(SEARCH_MATCHER)
    const rawBook = match?.[1]?.trim() ?? ""
    const rawChapter = match?.[2]
    const rawVerse = match?.[3]

    const normalizedBook = rawBook.replaceAll(" ", "")
    const chapter = rawChapter ? parseInt(rawChapter, 10) : undefined
    const verse = rawVerse ? parseInt(rawVerse, 10) : undefined
    const hasBookTerm = normalizedBook.length > 0

    // Agrupa o histórico por referência única e conta a frequência de cada uma
    const frequencyByKey = new Map<string, number>()
    for (const ref of history) {
        const key = verseKey(ref)
        frequencyByKey.set(key, (frequencyByKey.get(key) ?? 0) + 1)
    }

    const matchedBooks = getMatchedAbbrs(normalizedBook)
    const ambiguousBooks = getAmbiguousGroup(matchedBooks)
    const isAmbiguous = ambiguousBooks.length > 1

    // Conjunto de candidatos "efetivo": se houve empate, mantém todos os empatados;
    // se não, colapsa para o único melhor candidato (descarta os fracos de fato).
    const effectiveCandidates: Array<ScoredBook> = isAmbiguous
        ? ambiguousBooks
        : matchedBooks.slice(0, 1)

    const allowedAbbrs = new Set(effectiveCandidates.map((c) => c.abbr))
    const bookScoreByAbbr = new Map(effectiveCandidates.map((c) => [c.abbr, c.score]))

    // --- Endereço completo (livro + capítulo + versículo) -------------------
    // "só traga o versículo especificado, exceto quando o endereço é ambíguo"
    // Em qualquer caso, só retorna referências que realmente existem na Bíblia.
    if (hasBookTerm && chapter !== undefined && verse !== undefined) {
        if (isAmbiguous) {
            const validRefs = effectiveCandidates
                .map((c) => ({ ref: { book: c.abbr, chapter, verse } as VerseReference, score: c.score }))
                .filter((c) => referenceExists(c.ref))

            if (validRefs.length > 0) {
                return validRefs
                    .map((c) => {
                        const frequency = frequencyByKey.get(verseKey(c.ref)) ?? 0
                        return { ...c, frequency }
                    })
                    .sort((a, b) => b.frequency - a.frequency || b.score - a.score)
                    .map((c) => c.ref)
                    .slice(0, MAX_SUGGESTIONS)
            }
            // Nenhum dos candidatos ambíguos tem esse capítulo/versículo de fato:
            // cai para o fluxo normal abaixo.
        } else if (effectiveCandidates.length === 1) {
            const ref: VerseReference = { book: effectiveCandidates[0].abbr, chapter, verse }
            if (referenceExists(ref)) {
                return [ref]
            }
            // Referência não existe (capítulo/versículo fora do range real):
            // cai para o fluxo normal abaixo.
        }
        // Se o livro não foi reconhecido, cai para o fluxo normal abaixo.
    }

    // --- Fluxo normal: histórico + preenchimento sintético -------------------
    const referenceByKey = new Map<string, VerseReference>()
    for (const ref of history) referenceByKey.set(verseKey(ref), ref)

    const scoredHistory = Array.from(referenceByKey.values())
        .map((ref) => {
            // Gating: pertence a algum dos livros candidatos? (binário, não graduado)
            if (allowedAbbrs.size > 0 && !allowedAbbrs.has(ref.book)) return null
            if (chapter !== undefined && ref.chapter !== chapter) return null
            if (verse !== undefined && ref.verse !== verse) return null
            // Só sugere referências de histórico que existem de fato na Bíblia
            // (ex: histórico antigo de uma versão diferente, ou dado corrompido).
            if (!referenceExists(ref)) return null

            const frequency = frequencyByKey.get(verseKey(ref)) ?? 0
            const bookScore = bookScoreByAbbr.get(ref.book) ?? 0

            // Ranking: frequência de busca é o critério dominante — é o que faz
            // um histórico "1co-12-2" aparecer já a partir de "1", sem precisar
            // digitar o capítulo. bookScore e os bônus de capítulo/verso entram
            // apenas como desempate entre referências igualmente (ou pouco)
            // buscadas.
            const score =
                frequency * 100 +
                bookScore +
                (chapter !== undefined && ref.chapter === chapter ? 5 : 0) +
                (verse !== undefined && ref.verse === verse ? 5 : 0)

            return { ref, score }
        })
        .filter((e): e is { ref: VerseReference; score: number } => e !== null)
        .sort((a, b) => b.score - a.score)

    const suggestions: Array<VerseReference> = []
    const seen = new Set<string>()

    for (const { ref } of scoredHistory) {
        const key = verseKey(ref)
        if (seen.has(key)) continue
        seen.add(key)
        suggestions.push(ref)
        if (suggestions.length >= MAX_SUGGESTIONS) break
    }

    // Preenchimento sintético (sequência 1, 2, 3...), sempre limitado ao
    // número real de versículos do capítulo (e ao capítulo realmente existir).
    if (suggestions.length < MAX_SUGGESTIONS && effectiveCandidates.length > 0) {
        if (isAmbiguous) {
            // Round-robin entre os livros candidatos, para mostrar as
            // "possibilidades de outros livros" em vez de esgotar um só.
            const startChapter = chapter ?? 1
            const verseCounters = new Map(effectiveCandidates.map((c) => [c.abbr, verse ?? 1]))
            // Livros cujo capítulo nem existe ficam de fora do round-robin.
            const activeAbbrs = new Set(
                effectiveCandidates
                    .filter((c) => verseCount(c.abbr, startChapter) > 0)
                    .map((c) => c.abbr)
            )

            let safety = effectiveCandidates.length * SEQUENTIAL_FALLBACK_LIMIT
            while (suggestions.length < MAX_SUGGESTIONS && activeAbbrs.size > 0 && safety-- > 0) {
                let addedAny = false
                for (const { abbr } of effectiveCandidates) {
                    if (suggestions.length >= MAX_SUGGESTIONS) break
                    if (!activeAbbrs.has(abbr)) continue

                    const v = verseCounters.get(abbr)!
                    verseCounters.set(abbr, v + 1)

                    const maxVerse = verseCount(abbr, startChapter)
                    if (v > maxVerse) {
                        activeAbbrs.delete(abbr)
                        continue
                    }

                    const candidate: VerseReference = { book: abbr, chapter: startChapter, verse: v }
                    const key = verseKey(candidate)
                    if (seen.has(key)) continue
                    seen.add(key)
                    suggestions.push(candidate)
                    addedAny = true
                }
                if (!addedAny) break
            }
        } else {
            const { abbr } = effectiveCandidates[0]
            const startChapter = chapter ?? 1
            const startVerse = verse ?? 1
            const maxVerse = verseCount(abbr, startChapter)

            for (
                let v = startVerse;
                v <= maxVerse && v < startVerse + SEQUENTIAL_FALLBACK_LIMIT && suggestions.length < MAX_SUGGESTIONS;
                v++
            ) {
                const candidate: VerseReference = { book: abbr, chapter: startChapter, verse: v }
                const key = verseKey(candidate)
                if (seen.has(key)) continue
                seen.add(key)
                suggestions.push(candidate)
            }
        }
    }

    return suggestions
}

// --- Matching de livro ------------------------------------------------------

function getMatchedAbbrs(rawBook: string): Array<ScoredBook> {
    if (!rawBook) return []

    const foldedQuery = normalizeText(rawBook)
    if (!foldedQuery) return []

    const bestScoreByAbbr = new Map<BookAbbr, number>()

    // 1) Match por igualdade/prefixo, ignorando acentos e espaços.
    //    Isso já resolve abreviações ("1c", "2", "m") e nomes completos
    //    com ou sem acento ("joao", "genesis", "coríntios").
    for (const entry of FOLDED_ENTRIES) {
        let score: number | null = null

        if (entry.folded === foldedQuery) {
            score = 100
        } else if (entry.folded.startsWith(foldedQuery)) {
            score = 70 + 30 * (foldedQuery.length / entry.folded.length)
        }

        if (score === null) continue

        const current = bestScoreByAbbr.get(entry.abbr) ?? 0
        if (score > current) bestScoreByAbbr.set(entry.abbr, score)
    }

    // 2) Fallback fuzzy só quando nada casou por prefixo (ex: erro de digitação
    //    real, como "genecis" em vez de "genesis").
    if (bestScoreByAbbr.size === 0) {
        const keys = Object.keys(BOOK_TO_ABBR)
        const results = fuzz.extract(foldedQuery, keys, {
            scorer: fuzz.token_sort_ratio,
            processor: (choice: string) => normalizeText(choice),
        }) as Array<[string, number, number]>

        for (const [choice, score] of results) {
            if (score < BOOK_MATCH_THRESHOLD) continue
            const abbr = BOOK_TO_ABBR[choice]
            const current = bestScoreByAbbr.get(abbr) ?? 0
            if (score > current) bestScoreByAbbr.set(abbr, score)
        }
    }

    return Array.from(bestScoreByAbbr.entries())
        .map(([abbr, score]) => ({ abbr, score }))
        .sort((a, b) => b.score - a.score)
}

// Retorna o grupo de livros "empatados" com o melhor score (dentro da margem
// de ambiguidade). Se só um livro se destaca claramente, retorna só ele.
function getAmbiguousGroup(matched: Array<ScoredBook>): Array<ScoredBook> {
    if (matched.length === 0) return []
    const topScore = matched[0].score
    return matched.filter((m) => topScore - m.score <= AMBIGUITY_MARGIN)
}

function normalizeText(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .toLowerCase()
        .replaceAll(" ", "")
}

function verseKey(ref: VerseReference): string {
    return `${ref.book}-${ref.chapter}-${ref.verse}`
}