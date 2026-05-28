import { useState } from "react";
import { getDrugImage, checkInteraction } from "../api";
import { useDebounce } from "../hooks/useDebounce";
import DrugImage from "../components/DrugImage";
import DrugInfoCard from "../components/DrugInfoCard";
import SearchResultItem from "../components/SearchResultItem";
import Spinner from "../components/Spinner";

export default function InteractionPage({ myDrugsHook }) {
  const [query1, setQuery1] = useState("");
  const [drug1, setDrug1] = useState(null);
  const [image1, setImage1] = useState("");
  const [query2, setQuery2] = useState("");
  const [drug2, setDrug2] = useState(null);
  const [image2, setImage2] = useState("");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const s1 = useDebounce(drug1 ? "" : query1);
  const s2 = useDebounce(drug2 ? "" : query2);
  const { myDrugs } = myDrugsHook;

  function selectDrug1(d) {
    setDrug1(d); setQuery1(d.ITEM_NAME); s1.clear(); setResult(null);
    setImage1("");
    getDrugImage(d.ITEM_NAME).then(img => setImage1(img.imageUrl || "")).catch(() => {});
  }
  function selectDrug2(d) {
    setDrug2(d); setQuery2(d.ITEM_NAME); s2.clear(); setResult(null);
    setImage2("");
    getDrugImage(d.ITEM_NAME).then(img => setImage2(img.imageUrl || "")).catch(() => {});
  }
  function clearDrug1() { setDrug1(null); setQuery1(""); setResult(null); s1.clear(); setImage1(""); }
  function clearDrug2() { setDrug2(null); setQuery2(""); setResult(null); s2.clear(); setImage2(""); }

  async function handleCheck() {
    if (!drug1 || !drug2) return;
    setChecking(true);
    setResult(null);
    try {
      const data = await checkInteraction(drug1.ITEM_NAME, drug2.ITEM_NAME);
      setResult(data);
    } catch { setResult(null); }
    finally { setChecking(false); }
  }

  const myDrugsForDrug2 = myDrugs.filter(d => d.ITEM_SEQ !== drug1?.ITEM_SEQ);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs font-semibold text-violet-600 mb-4 uppercase tracking-wide">비교할 두 약품을 선택하세요</p>

        <div className="space-y-4">
          {/* 약품 1 */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">약품 1</p>
            {drug1 ? (
              <DrugInfoCard drug={drug1} imageUrl={image1} onClear={clearDrug1} />
            ) : (
              <>
                <input
                  type="text"
                  value={query1}
                  onChange={(e) => setQuery1(e.target.value)}
                  placeholder="약품명 입력 (예: 탁센레이디)"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-300"
                />
                {s1.results.length > 0 && (
                  <div className="mt-1.5 space-y-1.5 max-h-48 overflow-y-auto">
                    {s1.results.map((d, i) => (
                      <SearchResultItem key={d.ITEM_SEQ || i} drug={d} onSelect={selectDrug1} />
                    ))}
                  </div>
                )}
                {myDrugs.length > 0 && (
                  <div className="mt-2.5">
                    <p className="text-xs text-gray-400 mb-1.5">나의 약에서 선택</p>
                    <div className="flex flex-wrap gap-1.5">
                      {myDrugs.map((d, i) => (
                        <button
                          key={d.ITEM_SEQ || i}
                          onClick={() => selectDrug1(d)}
                          className="text-xs px-2.5 py-1.5 rounded-full border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors"
                        >
                          {d.ITEM_NAME}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-dashed border-gray-200" />
            <span className="text-gray-300 text-lg">+</span>
            <div className="flex-1 border-t border-dashed border-gray-200" />
          </div>

          {/* 약품 2 */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">약품 2</p>
            {drug2 ? (
              <DrugInfoCard drug={drug2} imageUrl={image2} onClear={clearDrug2} />
            ) : (
              <>
                <input
                  type="text"
                  value={query2}
                  onChange={(e) => setQuery2(e.target.value)}
                  placeholder="약품명 입력 (예: 케라신주)"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-300"
                />
                {s2.results.length > 0 && (
                  <div className="mt-1.5 space-y-1.5 max-h-48 overflow-y-auto">
                    {s2.results.map((d, i) => (
                      <SearchResultItem key={d.ITEM_SEQ || i} drug={d} onSelect={selectDrug2} />
                    ))}
                  </div>
                )}
                {myDrugsForDrug2.length > 0 && (
                  <div className="mt-2.5">
                    <p className="text-xs text-gray-400 mb-1.5">나의 약에서 선택</p>
                    <div className="flex flex-wrap gap-1.5">
                      {myDrugsForDrug2.map((d, i) => (
                        <button
                          key={d.ITEM_SEQ || i}
                          onClick={() => selectDrug2(d)}
                          className="text-xs px-2.5 py-1.5 rounded-full border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors"
                        >
                          {d.ITEM_NAME}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleCheck}
          disabled={!drug1 || !drug2 || checking}
          className="mt-5 w-full py-3 text-sm font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {checking ? "조회 중…" : "병용금기 확인하기"}
        </button>

        {checking && <Spinner label="병용금기 정보 조회 중…" />}
      </div>

      {result && (
        <div className={`rounded-2xl border p-5 ${
          result.is_prohibited ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{result.is_prohibited ? "⚠️" : "✅"}</span>
            <p className={`font-bold text-lg ${result.is_prohibited ? "text-red-700" : "text-green-700"}`}>
              {result.is_prohibited ? "병용금기 약물입니다" : "병용금기 아님"}
            </p>
          </div>

          <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-xl border border-gray-100">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <DrugImage drug={drug1} imageUrl={image1} size="sm" />
              <p className="text-xs text-gray-700 break-keep font-medium leading-tight">{drug1?.ITEM_NAME}</p>
            </div>
            <span className={`text-xl font-bold shrink-0 ${result.is_prohibited ? "text-red-400" : "text-green-400"}`}>
              {result.is_prohibited ? "✕" : "✓"}
            </span>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <DrugImage drug={drug2} imageUrl={image2} size="sm" />
              <p className="text-xs text-gray-700 break-keep font-medium leading-tight">{drug2?.ITEM_NAME}</p>
            </div>
          </div>

          {result.message && <p className="text-xs text-gray-500 mb-2">{result.message}</p>}

          {result.is_prohibited && result.interactions?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-600 mb-1">금기 상세 정보</p>
              {result.interactions.map((item, i) => (
                <div key={i} className="p-3 bg-white rounded-xl border border-red-200">
                  <p className="font-medium text-sm text-gray-700 break-keep">
                    {item.INGR_KOR_NAME} ↔ {item.MIXTURE_INGR_KOR_NAME}
                  </p>
                  {item.PROHBT_CONTENT && (
                    <p className="text-xs text-red-600 mt-1 break-keep">{item.PROHBT_CONTENT}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!result.is_prohibited && (
            <p className="text-sm text-green-600 mt-1">
              공공 DUR 데이터 기준으로 두 약품 사이의 병용금기 정보가 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
