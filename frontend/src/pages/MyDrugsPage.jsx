import { useState, useRef } from "react";
import { checkInteraction } from "../api";
import Spinner from "../components/Spinner";

export default function MyDrugsPage({ myDrugsHook, onGoSearch }) {
  const { myDrugs, remove } = myDrugsHook;
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkChecking, setBulkChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  const prevCountRef = useRef(myDrugs.length);
  if (myDrugs.length !== prevCountRef.current) {
    prevCountRef.current = myDrugs.length;
    if (bulkResults.length > 0) {
      setBulkResults([]);
      setChecked(false);
    }
  }

  async function handleBulkCheck() {
    setBulkChecking(true);
    setBulkResults([]);

    const pairs = [];
    for (let i = 0; i < myDrugs.length; i++) {
      for (let j = i + 1; j < myDrugs.length; j++) {
        pairs.push([myDrugs[i], myDrugs[j]]);
      }
    }

    const settled = await Promise.allSettled(
      pairs.map(([d1, d2]) => checkInteraction(d1.ITEM_NAME, d2.ITEM_NAME))
    );

    const results = pairs.map(([d1, d2], i) => ({
      drug1: d1,
      drug2: d2,
      ...(settled[i].status === "fulfilled"
        ? settled[i].value
        : { is_prohibited: false, message: "조회 실패" }),
    }));

    results.sort((a, b) => (b.is_prohibited ? 1 : 0) - (a.is_prohibited ? 1 : 0));
    setBulkResults(results);
    setBulkChecking(false);
    setChecked(true);
  }

  if (myDrugs.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-4xl mb-3">💊</p>
        <p className="font-semibold text-gray-700 mb-1">저장된 약이 없습니다</p>
        <p className="text-sm text-gray-400 mb-5">약품 검색 탭에서 별표(★)를 눌러 복용 중인 약을 저장하세요.</p>
        <button
          onClick={onGoSearch}
          className="text-sm px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        >
          약품 검색하러 가기
        </button>
      </div>
    );
  }

  const prohibitedCount = bulkResults.filter(r => r.is_prohibited).length;
  const pairCount = (myDrugs.length * (myDrugs.length - 1)) / 2;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-3">
          ★ 복용 중인 약 ({myDrugs.length}/10)
        </p>
        <div className="space-y-2">
          {myDrugs.map((d, i) => (
            <div
              key={d.ITEM_SEQ || i}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-xl shrink-0">💊</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm break-keep">{d.ITEM_NAME}</p>
                <p className="text-xs text-gray-500 mt-0.5">{d.ENTP_NAME}</p>
                <p className="text-xs text-gray-400 break-keep line-clamp-1">{d.MATERIAL_NAME}</p>
              </div>
              <button
                onClick={() => remove(d)}
                className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors shrink-0"
                title="목록에서 제거"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {myDrugs.length >= 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
              전체 병용금기 확인
            </p>
            <p className="text-xs text-gray-400">{pairCount}가지 조합</p>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            저장된 {myDrugs.length}개 약의 모든 조합을 한 번에 확인합니다.
          </p>

          <button
            onClick={handleBulkCheck}
            disabled={bulkChecking}
            className="w-full py-2.5 text-sm font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            {bulkChecking ? "확인 중…" : checked ? "다시 확인" : "전체 병용금기 확인하기"}
          </button>

          {bulkChecking && <Spinner label={`${pairCount}가지 조합 조회 중…`} />}

          {checked && !bulkChecking && (
            <div className={`mt-3 p-3 rounded-xl text-sm font-semibold text-center ${
              prohibitedCount > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
            }`}>
              {prohibitedCount > 0
                ? `⚠️ 병용금기 ${prohibitedCount}건 발견`
                : "✅ 병용금기 없음"}
            </div>
          )}

          {bulkResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {bulkResults.map((r, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border ${
                    r.is_prohibited
                      ? "border-red-200 bg-red-50"
                      : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base shrink-0">{r.is_prohibited ? "⚠️" : "✅"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium break-keep ${r.is_prohibited ? "text-red-800" : "text-gray-600"}`}>
                        {r.drug1.ITEM_NAME}
                        <span className="mx-1 font-normal opacity-60">+</span>
                        {r.drug2.ITEM_NAME}
                      </p>
                    </div>
                    <span className={`text-xs shrink-0 font-semibold ${r.is_prohibited ? "text-red-600" : "text-gray-400"}`}>
                      {r.is_prohibited ? "금기" : "이상없음"}
                    </span>
                  </div>
                  {r.is_prohibited && r.interactions?.map((item, j) => (
                    <p key={j} className="text-xs text-red-600 mt-1.5 ml-6 break-keep">
                      {item.INGR_KOR_NAME} ↔ {item.MIXTURE_INGR_KOR_NAME}
                      {item.PROHBT_CONTENT && ` — ${item.PROHBT_CONTENT}`}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
