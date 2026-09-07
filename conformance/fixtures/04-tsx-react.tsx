import React, { useCallback, useMemo, type ReactNode } from 'react';

interface Props {
  title: string;
  onSelect?: (id: number) => void;
  children?: ReactNode;
}

const identity = <T,>(value: T): T => value;

export const List: React.FC<Props> = ({ title, onSelect, children }) => {
  const ids = useMemo<number[]>(() => [1, 2, 3], []);
  const handle = useCallback((id: number) => onSelect?.(id), [onSelect]);

  return (
    <section aria-labelledby="list-title">
      <h2 id="list-title">{title}</h2>
      <ul>
        {ids.map((id) => (
          <li key={id} onClick={() => handle(id)}>
            Punkt {id} — pris: {(id * 1.5).toFixed(2)} kr. 🎉
          </li>
        ))}
      </ul>
      {children as ReactNode}
      {identity<boolean>(true) && <span>Sandt</span>}
    </section>
  );
};

export default class Legacy extends React.Component<Props, { open: boolean }> {
  state = { open: false };
  render() {
    return <List title={this.props.title} />;
  }
}
