/**
 * AWS instance families with their published vCPU and memory.
 *
 * These are facts from the AWS instance-type documentation, not estimates.
 * Everything in the config model derives from them: capacity is
 * `vCPU x (QPS per vCPU) x count`, and sub-project 4 will price by
 * family + size + hours. Keep them accurate — a candidate will quote them.
 */
export interface InstanceSize {
  size: string;
  vcpu: number;
  memoryGiB: number;
}

export interface InstanceFamily {
  label: string;
  /** Short note on what the family is for, shown as help text. */
  note: string;
  sizes: InstanceSize[];
}

export const INSTANCE_FAMILIES: Record<string, InstanceFamily> = {
  t3: {
    label: "Burstable (t3)",
    note: "Cheap baseline CPU with burst credits. Good for dev, low traffic, and spiky small services — not for sustained load.",
    sizes: [
      { size: "t3.micro", vcpu: 2, memoryGiB: 1 },
      { size: "t3.small", vcpu: 2, memoryGiB: 2 },
      { size: "t3.medium", vcpu: 2, memoryGiB: 4 },
      { size: "t3.large", vcpu: 2, memoryGiB: 8 },
      { size: "t3.xlarge", vcpu: 4, memoryGiB: 16 },
      { size: "t3.2xlarge", vcpu: 8, memoryGiB: 32 },
    ],
  },
  m5: {
    label: "General Purpose (m5)",
    note: "Balanced CPU to memory (1:4). The default choice when nothing about the workload is extreme.",
    sizes: [
      { size: "m5.large", vcpu: 2, memoryGiB: 8 },
      { size: "m5.xlarge", vcpu: 4, memoryGiB: 16 },
      { size: "m5.2xlarge", vcpu: 8, memoryGiB: 32 },
      { size: "m5.4xlarge", vcpu: 16, memoryGiB: 64 },
      { size: "m5.8xlarge", vcpu: 32, memoryGiB: 128 },
      { size: "m5.12xlarge", vcpu: 48, memoryGiB: 192 },
      { size: "m5.24xlarge", vcpu: 96, memoryGiB: 384 },
    ],
  },
  m6g: {
    label: "General Purpose ARM (m6g)",
    note: "Graviton2. Same 1:4 balance as m5 at roughly 20% lower price — the easy win when your runtime supports ARM.",
    sizes: [
      { size: "m6g.large", vcpu: 2, memoryGiB: 8 },
      { size: "m6g.xlarge", vcpu: 4, memoryGiB: 16 },
      { size: "m6g.2xlarge", vcpu: 8, memoryGiB: 32 },
      { size: "m6g.4xlarge", vcpu: 16, memoryGiB: 64 },
      { size: "m6g.8xlarge", vcpu: 32, memoryGiB: 128 },
      { size: "m6g.12xlarge", vcpu: 48, memoryGiB: 192 },
      { size: "m6g.16xlarge", vcpu: 64, memoryGiB: 256 },
    ],
  },
  c5: {
    label: "Compute Optimized (c5)",
    note: "1:2 CPU to memory. For CPU-bound work: encoding, compression, application servers doing real computation.",
    sizes: [
      { size: "c5.large", vcpu: 2, memoryGiB: 4 },
      { size: "c5.xlarge", vcpu: 4, memoryGiB: 8 },
      { size: "c5.2xlarge", vcpu: 8, memoryGiB: 16 },
      { size: "c5.4xlarge", vcpu: 16, memoryGiB: 32 },
      { size: "c5.9xlarge", vcpu: 36, memoryGiB: 72 },
      { size: "c5.12xlarge", vcpu: 48, memoryGiB: 96 },
      { size: "c5.24xlarge", vcpu: 96, memoryGiB: 192 },
    ],
  },
  c6g: {
    label: "Compute Optimized ARM (c6g)",
    note: "Graviton2 compute-optimized. Best price/performance for CPU-bound workloads that run on ARM.",
    sizes: [
      { size: "c6g.large", vcpu: 2, memoryGiB: 4 },
      { size: "c6g.xlarge", vcpu: 4, memoryGiB: 8 },
      { size: "c6g.2xlarge", vcpu: 8, memoryGiB: 16 },
      { size: "c6g.4xlarge", vcpu: 16, memoryGiB: 32 },
      { size: "c6g.8xlarge", vcpu: 32, memoryGiB: 64 },
      { size: "c6g.12xlarge", vcpu: 48, memoryGiB: 96 },
      { size: "c6g.16xlarge", vcpu: 64, memoryGiB: 128 },
    ],
  },
  r5: {
    label: "Memory Optimized (r5)",
    note: "1:8 CPU to memory. For caches, in-memory datasets, and databases whose working set must stay resident.",
    sizes: [
      { size: "r5.large", vcpu: 2, memoryGiB: 16 },
      { size: "r5.xlarge", vcpu: 4, memoryGiB: 32 },
      { size: "r5.2xlarge", vcpu: 8, memoryGiB: 64 },
      { size: "r5.4xlarge", vcpu: 16, memoryGiB: 128 },
      { size: "r5.8xlarge", vcpu: 32, memoryGiB: 256 },
      { size: "r5.12xlarge", vcpu: 48, memoryGiB: 384 },
      { size: "r5.24xlarge", vcpu: 96, memoryGiB: 768 },
    ],
  },
  fargate: {
    label: "Fargate task size",
    note: "Fargate bills per task vCPU and GB. Sizes are the supported CPU/memory combinations, not EC2 instance types.",
    sizes: [
      { size: "0.25 vCPU", vcpu: 0.25, memoryGiB: 0.5 },
      { size: "0.5 vCPU", vcpu: 0.5, memoryGiB: 1 },
      { size: "1 vCPU", vcpu: 1, memoryGiB: 2 },
      { size: "2 vCPU", vcpu: 2, memoryGiB: 4 },
      { size: "4 vCPU", vcpu: 4, memoryGiB: 8 },
      { size: "8 vCPU", vcpu: 8, memoryGiB: 16 },
      { size: "16 vCPU", vcpu: 16, memoryGiB: 32 },
    ],
  },
  // Database instance classes. RDS, Aurora, DocumentDB, and Neptune all bill by
  // db.* classes rather than raw EC2 types.
  "db.t3": {
    label: "Burstable DB (db.t3)",
    note: "Burstable database class. Dev, test, and small production databases with bursty query load.",
    sizes: [
      { size: "db.t3.medium", vcpu: 2, memoryGiB: 4 },
      { size: "db.t3.large", vcpu: 2, memoryGiB: 8 },
      { size: "db.t3.xlarge", vcpu: 4, memoryGiB: 16 },
      { size: "db.t3.2xlarge", vcpu: 8, memoryGiB: 32 },
    ],
  },
  "db.m5": {
    label: "General Purpose DB (db.m5)",
    note: "Balanced database class — the usual starting point for production OLTP.",
    sizes: [
      { size: "db.m5.large", vcpu: 2, memoryGiB: 8 },
      { size: "db.m5.xlarge", vcpu: 4, memoryGiB: 16 },
      { size: "db.m5.2xlarge", vcpu: 8, memoryGiB: 32 },
      { size: "db.m5.4xlarge", vcpu: 16, memoryGiB: 64 },
      { size: "db.m5.8xlarge", vcpu: 32, memoryGiB: 128 },
      { size: "db.m5.12xlarge", vcpu: 48, memoryGiB: 192 },
      { size: "db.m5.24xlarge", vcpu: 96, memoryGiB: 384 },
    ],
  },
  "db.r5": {
    label: "Memory Optimized DB (db.r5)",
    note: "Memory-heavy database class. The right answer when the working set should live in the buffer pool.",
    sizes: [
      { size: "db.r5.large", vcpu: 2, memoryGiB: 16 },
      { size: "db.r5.xlarge", vcpu: 4, memoryGiB: 32 },
      { size: "db.r5.2xlarge", vcpu: 8, memoryGiB: 64 },
      { size: "db.r5.4xlarge", vcpu: 16, memoryGiB: 128 },
      { size: "db.r5.8xlarge", vcpu: 32, memoryGiB: 256 },
      { size: "db.r5.12xlarge", vcpu: 48, memoryGiB: 384 },
      { size: "db.r5.24xlarge", vcpu: 96, memoryGiB: 768 },
    ],
  },
  // ElastiCache node classes.
  "cache.t3": {
    label: "Burstable Cache (cache.t3)",
    note: "Small burstable cache nodes. Fine for development and modest hot sets.",
    sizes: [
      { size: "cache.t3.micro", vcpu: 2, memoryGiB: 0.5 },
      { size: "cache.t3.small", vcpu: 2, memoryGiB: 1.37 },
      { size: "cache.t3.medium", vcpu: 2, memoryGiB: 3.09 },
    ],
  },
  "cache.r6g": {
    label: "Memory Optimized Cache (cache.r6g)",
    note: "Graviton2 memory-optimized cache nodes — the production default for Redis and Valkey.",
    sizes: [
      { size: "cache.r6g.large", vcpu: 2, memoryGiB: 13.07 },
      { size: "cache.r6g.xlarge", vcpu: 4, memoryGiB: 26.32 },
      { size: "cache.r6g.2xlarge", vcpu: 8, memoryGiB: 52.82 },
      { size: "cache.r6g.4xlarge", vcpu: 16, memoryGiB: 105.81 },
      { size: "cache.r6g.8xlarge", vcpu: 32, memoryGiB: 209.55 },
      { size: "cache.r6g.12xlarge", vcpu: 48, memoryGiB: 317.77 },
    ],
  },
};

/** Look up a size across all families. */
export function findSize(size: string): InstanceSize | undefined {
  for (const family of Object.values(INSTANCE_FAMILIES)) {
    const hit = family.sizes.find((s) => s.size === size);
    if (hit) return hit;
  }
  return undefined;
}

/** Which family does this size belong to? */
export function familyOf(size: string): string | undefined {
  for (const [key, family] of Object.entries(INSTANCE_FAMILIES)) {
    if (family.sizes.some((s) => s.size === size)) return key;
  }
  return undefined;
}
