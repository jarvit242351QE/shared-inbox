import IORedis, { type Redis, type RedisOptions } from "ioredis";

const url = process.env.REDIS_URL;
if (!url) throw new Error("REDIS_URL is required");

const baseOpts: RedisOptions = { maxRetriesPerRequest: null, enableReadyCheck: true };

let bullConn: Redis | null = null;
export function getBullConnection(): Redis {
  if (!bullConn) bullConn = new IORedis(url!, baseOpts);
  return bullConn;
}

let publisher: Redis | null = null;
export function getPublisher(): Redis {
  if (!publisher) publisher = new IORedis(url!, baseOpts);
  return publisher;
}

export function createSubscriber(): Redis {
  return new IORedis(url!, baseOpts);
}
