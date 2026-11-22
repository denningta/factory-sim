import { describe, expect, it } from 'vitest';
import { createSimulation } from './simulation';

/**
 * M/M/1 validation (ADR-0007): Poisson arrivals at rate λ, one server with exponential
 * service at rate μ. Theory: Wq = ρ/(μ−λ), Lq = ρ²/(1−ρ), utilization = ρ = λ/μ.
 */
function runMM1(seed: number, lambda: number, mu: number, warmUp: number, horizon: number) {
  const sim = createSimulation({ seed });
  const arrivals = sim.rng.fork('arrivals');
  const services = sim.rng.fork('service');
  const server = sim.createResource('server', 1);
  const wait = sim.createTally();

  const arrive = () => {
    const customer = sim.createEntity({});
    server.request(customer, () => {
      wait.add(sim.now - customer.createdAt);
      sim.schedule(services.exponential(1 / mu), () => server.release(customer));
    });
    sim.schedule(arrivals.exponential(1 / lambda), arrive);
  };
  sim.schedule(arrivals.exponential(1 / lambda), arrive);

  sim.runUntil(warmUp);
  sim.resetStatistics();
  sim.runUntil(warmUp + horizon);
  return {
    wq: wait.mean,
    served: wait.count,
    util: server.utilization(),
    lq: server.averageQueueLength(),
  };
}

describe('M/M/1 queue', () => {
  // ~2.4M customers (~2 s): the standard error of the mean wait is ~0.6% at ρ = 0.8, so
  // the 2% bound holds for any seed, not just this one (checked over 11 seeds: max 1.4%).
  it('matches the theoretical waiting time within 2% over a long run', () => {
    const lambda = 0.8;
    const mu = 1;
    const rho = lambda / mu;
    const r = runMM1(2026, lambda, mu, 10_000, 3_000_000);
    const wq = rho / (mu - lambda); // 4 s
    expect(r.served).toBeGreaterThan(2_300_000);
    expect(Math.abs(r.wq - wq) / wq).toBeLessThan(0.02);
    expect(Math.abs(r.util - rho) / rho).toBeLessThan(0.02);
    const lq = (rho * rho) / (1 - rho); // 3.2
    expect(Math.abs(r.lq - lq) / lq).toBeLessThan(0.02);
  }, 30_000);
});
