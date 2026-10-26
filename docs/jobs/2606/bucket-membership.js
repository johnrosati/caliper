// Work stages may reference existing bodies without duplicating model occurrences.
export function inBucket(plan, bodyId, bucketId) {
  return plan.assignments[bodyId] === bucketId ||
    Boolean(plan.buckets.find(b => b.id === bucketId)?.linkedBodyIds?.includes(bodyId));
}
