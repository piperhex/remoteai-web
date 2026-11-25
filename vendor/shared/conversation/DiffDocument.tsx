import { memo, useMemo } from "react";
import { DiffFileList } from "./DiffFileList";
import type { DiffFile, DiffLine } from "./diff";
import { pairDiffLines } from "./diff";
import { CopyButton } from "./CopyButton";
import { useDiffText } from "../chat/diffText";
import { useDiffAutoLoad } from "../chat/useDiffAutoLoad";
import { fileLanguage, HighlightedCode } from "./CodeHighlight";
import styles from "./DiffView.module.less";

const REDUNDANT_DIFF_HEADER = /^(diff --git |index |--- |\+\+\+ |new file mode |deleted file mode )/;

function UnifiedLine({ line, language }: { line: DiffLine; language: string }) {
  const sign = { add: "+", remove: "−", context: " ", hunk: " ", meta: " " }[line.kind];
  return <div className={`${styles.line} ${styles[line.kind]}`}>
    <span className={styles.number}>{line.oldLine}</span><span className={styles.number}>{line.newLine}</span>
    <span className={styles.sign} aria-hidden="true">{sign}</span>
    <HighlightedCode text={line.text || " "} language={line.kind === "hunk" || line.kind === "meta" ? "" : language} />
  </div>;
}

function SplitCell({ line, side, language }: { line?: DiffLine; side: "left" | "right"; language: string }) {
  return <div className={`${styles.cell} ${line ? styles[line.kind] : styles.empty}`}>
    <span className={styles.number}>{side === "left" ? line?.oldLine : line?.newLine}</span>
    <HighlightedCode text={line?.text || " "} language={language} />
  </div>;
}

export function DiffContent({ file, split }: { file: DiffFile; split: boolean }) {
  const t = useDiffText();
  const lines = useMemo(() => file.lines.filter((line) => line.kind !== "meta"
    || !REDUNDANT_DIFF_HEADER.test(line.text)), [file.lines]);
  const pairs = useMemo(() => split ? pairDiffLines(lines) : [], [lines, split]);
  const language = fileLanguage(file.path);
  const total = split ? pairs.length : lines.length;
  const { limit, loadMore, endRef, onScroll } = useDiffAutoLoad(total);
  return <>
    <div className={styles.fileToolbar}>
      <span>{file.previousPath ? `${file.previousPath} → ${file.path}` : file.path}</span>
      <CopyButton text={file.raw} label={t("client.chat.copyDiff")} />
    </div>
    {total ? <div className={styles.codeScroll} tabIndex={0} onScroll={onScroll}
      aria-label={t("client.chat.codeDiffFor", { path: file.path })}>
      {split ? <div className={styles.split}>
        <div className={styles.splitLabels}><span>{t("client.chat.before")}</span><span>{t("client.chat.after")}</span></div>
        {pairs.slice(0, limit).map((pair, index) => pair.heading
          ? <div key={index} className={styles[pair.heading.kind]}><code>{pair.heading.text}</code></div>
          : <div key={index} className={styles.pair}>
            <SplitCell line={pair.left} side="left" language={language} />
            <SplitCell line={pair.right} side="right" language={language} />
          </div>)}
      </div> : lines.slice(0, limit).map((line, index) => <UnifiedLine line={line} language={language} key={index} />)}
      {limit < total && <span ref={endRef} aria-hidden
        style={{ display: 'block', position: 'sticky', left: 0, width: 1, height: 1 }} />}
    </div> : <p className={styles.notice}>{t(file.kind === "add" ? "client.chat.newEmptyFile" : "client.chat.noTextDiffIsAvailableForThisFile")}</p>}
    {limit < total && <button className={styles.more} onClick={loadMore}>
      {t("client.chat.showMoreLinesRemaining", { count: total - limit })}</button>}
  </>;
}

export interface DiffDocumentProps {
  files: readonly DiffFile[]; title?: string; status?: string; initialOpen?: boolean; continuous?: boolean;
  filePath?: string;
}

export const DiffDocument = memo(function DiffDocument({ files: allFiles, title = "client.shared.fileChanges", status,
  initialOpen = false, continuous = false, filePath }: DiffDocumentProps) {
  const files = useMemo(() => filePath === undefined ? allFiles : allFiles.filter(file => file.path === filePath),
    [allFiles, filePath]);
  return <DiffFileList files={files} title={title} status={status} continuous={continuous}
    initialFile={initialOpen ? (filePath === undefined ? 0 : 'all') : undefined}
    renderBody={(index, split) => <DiffContent file={files[index]} split={split} />} />;
});
