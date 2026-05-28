import { useState } from "react";

export function useMyDrugs() {
  const [myDrugs, setMyDrugs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("myDrugs") || "[]"); }
    catch { return []; }
  });

  function toggle(drug) {
    setMyDrugs(prev => {
      const exists = prev.some(d => d.ITEM_SEQ === drug.ITEM_SEQ);
      const next = exists
        ? prev.filter(d => d.ITEM_SEQ !== drug.ITEM_SEQ)
        : [...prev, drug].slice(0, 10);
      localStorage.setItem("myDrugs", JSON.stringify(next));
      return next;
    });
  }

  function remove(drug) {
    setMyDrugs(prev => {
      const next = prev.filter(d => d.ITEM_SEQ !== drug.ITEM_SEQ);
      localStorage.setItem("myDrugs", JSON.stringify(next));
      return next;
    });
  }

  function has(drug) {
    return myDrugs.some(d => d.ITEM_SEQ === drug.ITEM_SEQ);
  }

  return { myDrugs, toggle, remove, has };
}
