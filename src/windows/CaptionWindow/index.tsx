import { useAppState } from "../../contexts/VerseReferenceContext"
import "./style.css"
import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import ACF from "../../acf.json"
import { Bible, VerseReference } from "../../types";
import { ABBR_TO_BOOK } from "../../constants";
import getVerseByReference from "../../utils/getVerseByReference";


export default function CaptionWindow() {
    const { reference, setReference } = useAppState()

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

    return reference
        ? (
            <div className="caption-outer">
                <div className="caption-inner">
                    <div className="verse-text">{getVerseByReference(ACF as Bible, reference)}</div>
                    <div className="verse-address">{ABBR_TO_BOOK[reference.book]} {reference.chapter}:{reference.verse} (ACF)</div>
                </div>
            </div>
        )
        : (
            <div className="caption-empty"></div>
        )
}