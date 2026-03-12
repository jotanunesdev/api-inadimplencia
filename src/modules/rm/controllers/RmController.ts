import { Request, Response } from "express";
import { RmService } from "../services/RmService";
import { RmGatewayError, ValidationError } from "../types/Rm";

export class RmController {
  constructor(private readonly rmService: RmService) {}

  public health = (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true });
  };

  public partitionOptions = async (req: Request, res: Response): Promise<void> => {
    const context = this.getInputValue(req, "context");

    try {
      const options = await this.rmService.getPartitionOptions({
        dataserver: this.toTrimmed(this.toSingleParam(req.params.dataserver)),
        context
      });

      res.status(200).json(options);
    } catch (error: unknown) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error instanceof RmGatewayError) {
        res.status(502).json({ error: "Falha ao chamar RM", details: error.details });
        return;
      }

      if (error instanceof Error) {
        res.status(502).json({ error: "Falha ao chamar RM", details: error.message });
        return;
      }

      res.status(502).json({ error: "Falha ao chamar RM", details: "Erro inesperado" });
    }
  };

  public proxy = async (req: Request, res: Response): Promise<void> => {
    const context = this.getInputValue(req, "context");
    const filter = this.getInputValue(req, "filter");
    const page = this.getInputValue(req, "page");
    const primaryKey = this.getInputValue(req, "primaryKey");
    const xml = this.getInputValue(req, "xml");
    const rootTag = this.getInputValue(req, "rootTag");
    const record = this.getRecordInput(req);

    try {
      const resultJson = await this.rmService.execute({
        dataserver: this.toTrimmed(this.toSingleParam(req.params.dataserver)),
        operation: this.toTrimmed(this.toSingleParam(req.params.readvieworreadrecord)),
        context,
        filter,
        page,
        primaryKey,
        xml,
        rootTag,
        record
      });

      res.status(200).json(resultJson);
    } catch (error: unknown) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error instanceof RmGatewayError) {
        res.status(502).json({ error: "Falha ao chamar RM", details: error.details });
        return;
      }

      if (error instanceof Error) {
        res.status(502).json({ error: "Falha ao chamar RM", details: error.message });
        return;
      }

      res.status(502).json({ error: "Falha ao chamar RM", details: "Erro inesperado" });
    }
  };

  private toSingleValue(value: unknown): string | undefined {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value) && value.length > 0) {
      return this.toSingleValue(value[0]);
    }

    return undefined;
  }

  private toTrimmed(value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    return value.trim();
  }

  private toSingleParam(value: string | string[] | undefined): string | undefined {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
      return value[0];
    }

    return undefined;
  }

  private getInputValue(
    req: Request,
    key: "context" | "filter" | "page" | "primaryKey" | "xml" | "rootTag"
  ): string | undefined {
    const queryValue = this.toSingleValue(req.query[key]);
    const bodyValue = this.toSingleValue((req.body as Record<string, unknown> | undefined)?.[key]);

    const canUseBody = req.method !== "GET";
    if (canUseBody && bodyValue !== undefined) {
      return bodyValue;
    }

    return queryValue ?? bodyValue;
  }

  private getRecordInput(req: Request): Record<string, unknown> | undefined {
    const bodyRecord = this.parseRecordValue((req.body as Record<string, unknown> | undefined)?.record);
    const queryRecord = this.parseRecordValue(req.query.record);

    if (req.method !== "GET" && bodyRecord) {
      return bodyRecord;
    }

    return bodyRecord ?? queryRecord;
  }

  private parseRecordValue(value: unknown): Record<string, unknown> | undefined {
    if (this.isPlainObject(value)) {
      return value;
    }

    const asSingle = this.toSingleValue(value);
    if (!asSingle) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(asSingle) as unknown;
      if (this.isPlainObject(parsed)) {
        return parsed;
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
