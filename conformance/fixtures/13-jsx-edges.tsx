const braceText = <a href="#">{'{'}</a>;
const commentOnly = <A>{/* kun en kommentar */}</A>;
const templateChild = <div>{`x${y}`}</div>;
const namespaced = <svg:rect a:b="c" />;
const memberName = <Outer.Inner.Deep prop={items.map((i) => i.value)} />;
const entities = <p>&amp; &lt; &#65; &#x1F389; &notARealEntity; æøå</p>;
const attrEntities = <input placeholder="&amp;&#65;" data-x='&lt;' />;
const emptyFragment = <></>;
const whitespaceOnly = (
  <ul>
    <li>a</li>
    {' '}
    <li>b</li>
  </ul>
);
const spread = <div {...props} key="k" />;
const nestedExpression = <div>{cond ? <span>ja</span> : <span>nej</span>}</div>;
export { braceText, commentOnly, templateChild, namespaced, memberName, entities, attrEntities, emptyFragment, whitespaceOnly, spread, nestedExpression };
