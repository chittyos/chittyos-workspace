/**
 * ChittyID Client - Mints verifiable identifiers from id.chitty.cc
 * Version: 1.0.0
 */

import type { ChittyIdMintRequest, ChittyIdMintResponse } from "./types";

export class ChittyIdClient {
  private serviceUrl: string;
  private token?: string;

  constructor(serviceUrl: string, token?: string) {
    this.serviceUrl = serviceUrl;
    this.token = token;
  }

  /**
   * Mint a new ChittyID from the central authority
   * @param domain - Domain namespace (e.g., "todo")
   * @param subtype - Subtype within domain (e.g., "task")
   * @param metadata - Optional metadata to embed
   * @param bearerToken - Bearer token for authentication (overrides constructor token)
   * @returns Minted ChittyID response
   * @throws Error if minting fails or token is missing
   */
  async mint(
    domain: string,
    subtype: string,
    metadata?: Record<string, unknown>,
    bearerToken?: string,
  ): Promise<ChittyIdMintResponse> {
    const token = bearerToken || this.token;

    if (!token) {
      throw new Error(
        "ChittyID token is required for minting. Ensure CHITTY_ID_TOKEN is set.",
      );
    }

    const request: ChittyIdMintRequest = {
      domain,
      subtype,
      metadata,
    };

    try {
      const response = await fetch(`${this.serviceUrl}/mint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `ChittyID minting failed (${response.status}): ${errorText}`,
        );
      }

      const data = (await response.json()) as ChittyIdMintResponse;

      if (!data.id) {
        throw new Error(
          "ChittyID service returned invalid response (missing id field)",
        );
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to mint ChittyID: ${error.message}`);
      }
      throw new Error("Failed to mint ChittyID: Unknown error");
    }
  }

  /**
   * Validate a ChittyID with the central service
   * @param id - ChittyID to validate
   * @param bearerToken - Bearer token for authentication
   * @returns true if valid, false otherwise
   */
  async validate(id: string, bearerToken?: string): Promise<boolean> {
    const token = bearerToken || this.token;

    if (!token) {
      return false;
    }

    try {
      const response = await fetch(`${this.serviceUrl}/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Health check for ChittyID service
   * @returns Object with reachable status and latency
   */
  async healthCheck(): Promise<{ reachable: boolean; latency_ms?: number }> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.serviceUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const latency = Date.now() - startTime;

      return {
        reachable: response.ok,
        latency_ms: latency,
      };
    } catch {
      return {
        reachable: false,
      };
    }
  }
}
