import { useAppState } from "../../contexts/VerseReferenceContext"
import "./style.css"
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ACF from "../../acf.json"
import { Bible, VerseReference } from "../../types";
import { ABBR_TO_BOOK } from "../../constants";
import getVerseByReference from "../../utils/getVerseByReference";

const TRANSITION_MS = 300;

export default function CaptionWindow() {
    const { reference, setReference } = useAppState()
    const [displayReference, setDisplayReference] = useState<VerseReference | null>(reference);

    useEffect(() => {
        const interval = setInterval(() => {
            invoke<string>('get_valor')
                .then(JSON.parse)
                .then((newReference) => {
                    if(newReference != reference) {
                        setReference(newReference)
                    }
                })
        }, 100);

        return () => {
            clearInterval(interval);
        };
    }, []);

    // Mantém o conteúdo anterior renderizado durante o fade-out,
    // e só o limpa depois que a transição termina.
    useEffect(() => {
        if (reference) {
            setDisplayReference(reference);
            return;
        }

        const timeout = setTimeout(() => {
            setDisplayReference(null);
        }, TRANSITION_MS);

        return () => clearTimeout(timeout);
    }, [reference]);

    const hasContent = Boolean(reference);

    return (
        <div className={`caption-outer ${hasContent ? "is-visible" : ""}`}>
            <div className="caption-inner">
                {displayReference && (
                    <>
                        <div className="verse-text">{getVerseByReference(ACF as Bible, displayReference)}</div>
                        <div className="verse-address">{ABBR_TO_BOOK[displayReference.book]} {displayReference.chapter}:{displayReference.verse} (ACF)</div>
                    </>
                )}
            </div>
        </div>
    )
}