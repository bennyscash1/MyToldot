import styles from './poster-tree.module.css';

export function PosterUnionNode({
  x,
  y,
  width,
  height,
  visible,
  isDivorced,
  connectorColor = '#5ba4b8',
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  isDivorced: boolean;
  connectorColor?: string;
}) {
  if (!visible) return null;
  return (
    <div
      className={`${styles.union} ${isDivorced ? styles.unionDivorced : ''}`}
      style={{
        left: x,
        top: y,
        width,
        height,
        backgroundColor: isDivorced ? undefined : connectorColor,
      }}
      aria-hidden
    />
  );
}
