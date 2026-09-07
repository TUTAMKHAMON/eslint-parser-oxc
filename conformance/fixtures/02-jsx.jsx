import React, { Fragment } from 'react';

export function Component({ title, children }) {
  const items = [1, 2, 3];
  return (
    <div className="wrapper" data-testid='root' aria-label="Hovedindhold">
      <h1 style={{ color: 'red' }}>{title}</h1>
      {/* a comment inside JSX */}
      <>
        {items.map((item) => (
          <Item key={item} value={item} {...rest} />
        ))}
      </>
      <Namespaced.Deep.Component onClick={() => setOpen(!open)}>
        Tekst med æøå og emoji 🎉 og &amp; entity
      </Namespaced.Deep.Component>
      <svg viewBox="0 0 10 10"><rect width={10} /></svg>
      <input disabled value={value} onChange={(e) => onChange(e.target.value)} />
      {children}
      <p>
        Flere linjer
        med tekst
      </p>
      <Fragment key="f">{null}</Fragment>
    </div>
  );
}
