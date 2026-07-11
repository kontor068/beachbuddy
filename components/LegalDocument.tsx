import React from 'react';
import { LanguageCode } from '../types';
import { LegalBlock, LegalDoc, LegalKind, parseLegalText } from '../utils/legalContent';

interface LegalDocumentProps {
  doc: LegalDoc;
  language: LanguageCode;
  /** Opens a sibling legal doc when an inline {privacy}/{cookies}/{terms} link is clicked. */
  onOpenModal: (kind: LegalKind) => void;
}

const InlineText: React.FC<{ text: string; language: LanguageCode; onOpenModal: (kind: LegalKind) => void }> = ({
  text,
  language,
  onOpenModal,
}) => {
  const segments = parseLegalText(text, language);
  return (
    <>
      {segments.map((segment, index) => {
        if ('text' in segment) return <React.Fragment key={index}>{segment.text}</React.Fragment>;
        if (segment.modal) {
          const kind = segment.modal;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onOpenModal(kind)}
              className="font-bold text-sky-700 underline underline-offset-2 hover:text-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {segment.label}
            </button>
          );
        }
        return (
          <a
            key={index}
            href={segment.href}
            target={/^(mailto:|tel:)/.test(segment.href ?? '') ? undefined : '_blank'}
            rel="noopener noreferrer"
            className="font-bold text-sky-700 underline underline-offset-2 hover:text-sky-800"
          >
            {segment.label}
          </a>
        );
      })}
    </>
  );
};

const Block: React.FC<{ block: LegalBlock; language: LanguageCode; onOpenModal: (kind: LegalKind) => void }> = ({
  block,
  language,
  onOpenModal,
}) => {
  if ('h' in block) {
    return <h3 className="pt-1 text-sm font-extrabold text-slate-900">{block.h}</h3>;
  }
  if ('note' in block) {
    return (
      <p className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-700">
        <InlineText text={block.note} language={language} onOpenModal={onOpenModal} />
      </p>
    );
  }
  if ('ul' in block) {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm font-medium leading-relaxed text-slate-600">
        {block.ul.map((item, index) => (
          <li key={index}>
            <InlineText text={item} language={language} onOpenModal={onOpenModal} />
          </li>
        ))}
      </ul>
    );
  }
  if ('table' in block) {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              {block.table.head.map((cell, index) => (
                <th key={index} className="border-b border-slate-200 px-3 py-2 font-extrabold text-slate-800">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.table.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="align-top">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border-b border-slate-100 px-3 py-2 font-medium leading-relaxed text-slate-600">
                    <InlineText text={cell} language={language} onOpenModal={onOpenModal} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <p className="text-sm font-medium leading-relaxed text-slate-600">
      <InlineText text={block.p} language={language} onOpenModal={onOpenModal} />
    </p>
  );
};

export const LegalDocument: React.FC<LegalDocumentProps> = ({ doc, language, onOpenModal }) => (
  <div className="space-y-3 text-left">
    {doc.blocks.map((block, index) => (
      <Block key={index} block={block} language={language} onOpenModal={onOpenModal} />
    ))}
  </div>
);
