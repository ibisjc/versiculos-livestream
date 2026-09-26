import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./style.css"
import { useAppState } from "../../contexts/VerseReferenceContext";
import { ChevronLeft, ChevronRight } from "lucide-react";
import searchVerse from "../../utils/searchVerse";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Bible, VerseReference } from "../../types";
import { ABBR_TO_BOOK } from "../../constants";
import { invoke } from "@tauri-apps/api/core";
import getAdjacentVerse from "../../utils/getAdjacentVerse";
import ACF from "../../acf.json"
import getVerseByReference from "../../utils/getVerseByReference";

const CAPTION_WINDOW = 'caption-window'

export default function ControlWindow() {
  const { reference, isCaptionOpen, setReference, setIsCaptionOpen } = useAppState()

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VerseReference[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [history, setHistory] = useState<Array<VerseReference>>([])

  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Mantém o input sempre em foco ao montar o componente
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [selectedIndex, results]);

  useEffect(() => {
    console.log()
    invoke('set_valor', { reference: JSON.stringify(reference) });
  }, [reference])

  function openCaptionWindow() {
    const captionWindow = new WebviewWindow(CAPTION_WINDOW, {
      url: '/caption',
      title: 'Exibição de versículo',
      width: 1400,
      height: 300,
      decorations: false,
      transparent: true,
      shadow: false,
    });

    captionWindow.setAlwaysOnBottom(true);

    captionWindow.once('tauri://created', () => {
      console.log('Janela criada com sucesso');
      setIsCaptionOpen(true)
    });

    captionWindow.once('tauri://error', (e) => {
      console.error('Erro ao criar janela:', e);
    });
  }

  async function closeCaptionWindow() {
    const captionWindow = await WebviewWindow.getByLabel(CAPTION_WINDOW)

    if (!captionWindow) {
      return
    }

    await captionWindow.close()
    setIsCaptionOpen(false)
  }

  function handleVerseSearch(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setQuery(value);

    const found = searchVerse(value, ACF as Bible, history);

    setResults(found);
    setSelectedIndex(0); // sempre volta o cursor da lista para o topo
  }

  function handleGoToAdjacentVerse(direction: 'prev' | 'next') {
    if(!reference) {
      return
    }

    const newVerse = getAdjacentVerse(ACF as Bible, reference, direction)
    if(!newVerse) {
      return
    }

    setReference(newVerse)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case "ArrowLeft":
        event.preventDefault();
        handleGoToAdjacentVerse('prev');
        break;
      case "ArrowRight":
        event.preventDefault();
        handleGoToAdjacentVerse('next');
        break;
      case "Enter":
        event.preventDefault();
        setReference(results[selectedIndex]);
        setHistory([...history, results[selectedIndex]])
        inputRef.current?.select(); // seleciona todo o texto do input
        break;
      case "Escape":
        setReference(null);
        break;
      default:
        break;
    }
  }

  function handleSelectResult(index: number) {
    setSelectedIndex(index);
    setReference(results[index]);
    inputRef.current?.focus();
  }

  return (
    <main className="container">
      <div className="input-container">
        <div className="search-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleVerseSearch}
            onKeyDown={handleKeyDown}
            onBlur={() => inputRef.current?.focus()}
            autoFocus
          />
          {results.length > 0 && (
            <ul className="verse-results">
              {results.map((result, index) => (
                <li
                  key={`${result.book}-${result.chapter}-${result.verse}-${index}`}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  className={index === selectedIndex ? "selected" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectResult(index)}
                >
                  {ABBR_TO_BOOK[result.book]} {result.chapter}:{result.verse}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="control-container">
        <div>
          <button onClick={() => handleGoToAdjacentVerse('prev')}><ChevronLeft /></button>
          <button onClick={() => handleGoToAdjacentVerse('next')}><ChevronRight /></button>
        </div>
        <div className="verse-preview">
          <span>{reference ? 'Próximo versículo:' : (results.length ? 'Versículo selecionado:' : '')}</span>
          <p>{
            reference
              ? getVerseByReference(ACF as Bible, getAdjacentVerse(ACF as Bible, reference, 'next'))
              : getVerseByReference(ACF as Bible, results[selectedIndex])
          }</p>
        </div>
        {
          isCaptionOpen
            ? <button onClick={closeCaptionWindow}>Fechar legenda</button>
            : <button onClick={openCaptionWindow}>Abrir legenda</button>
        }
      </div>
    </main>
  );
}