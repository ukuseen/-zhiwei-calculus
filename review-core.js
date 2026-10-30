(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReviewCore = api;
})(globalThis, function () {
  "use strict";
  function validateRecords(value, known) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("无效答题记录");
    const clean = Object.create(null);
    Object.keys(value).forEach(function (id) {
      if (!known.has(id)) return;
      const r = value[id];
      if (!r || !Number.isSafeInteger(r.attempts) || r.attempts < 1 || r.attempts > 10000000 ||
          !Number.isSafeInteger(r.correct) || r.correct < 0 || r.correct > r.attempts ||
          typeof r.lastCorrect !== "boolean" || (r.lastCorrect && r.correct === 0) ||
          (!r.lastCorrect && r.correct === r.attempts) || !Number.isSafeInteger(r.updatedAt) || r.updatedAt < 0) throw new Error("无效答题记录");
      clean[id] = {attempts:r.attempts, correct:r.correct, lastCorrect:r.lastCorrect, updatedAt:r.updatedAt};
    });
    return clean;
  }
  function mergeRecords(current, incoming, known) {
    const checked = validateRecords(incoming, known), result = validateRecords(current, known);
    Object.keys(checked).forEach(function (id) {
      const a = result[id], b = checked[id];
      if (!a || b.updatedAt > a.updatedAt || (b.updatedAt === a.updatedAt && b.attempts > a.attempts)) result[id] = b;
    });
    return result;
  }
  function recordAnswer(records, id, correct, timestamp) {
    const prev = records[id] || {attempts:0, correct:0};
    return {attempts:prev.attempts + 1, correct:prev.correct + (correct ? 1 : 0), lastCorrect:correct, updatedAt:timestamp};
  }
  function summarize(questions, records) {
    let attempted=0, latestCorrect=0, attempts=0, correct=0;
    questions.forEach(function (q) {
      const r=records[q.id]; if (!r) return;
      attempted++; latestCorrect += r.lastCorrect ? 1 : 0; attempts+=r.attempts; correct+=r.correct;
    });
    return {total:questions.length, attempted, latestCorrect, mistakes:attempted-latestCorrect, attempts, correct,
      accuracy:attempts ? Math.round(correct/attempts*100) : null};
  }
  function shuffled(values, random) {
    const arr=values.slice(); random=random||Math.random;
    for (let i=arr.length-1;i>0;i--) {const j=Math.floor(random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];}
    return arr;
  }
  // Round robin by chapter ensures a mixed paper includes all three chapters.
  function selectQuestions(questions, size, random) {
    const groups=Object.create(null);
    shuffled(questions,random).forEach(function(q){ const key=q.section.split(".")[0]; (groups[key]||(groups[key]=[])).push(q); });
    const keys=shuffled(Object.keys(groups),random), result=[];
    while (result.length<Math.min(size,questions.length)) {
      keys.forEach(function(k){ if(groups[k].length && result.length<size) result.push(groups[k].pop()); });
    }
    return shuffled(result,random);
  }
  return {validateRecords,mergeRecords,recordAnswer,summarize,shuffled,selectQuestions};
});
