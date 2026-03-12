import type { NextFunction, Request, Response } from 'express';
import { EntryInvoiceService } from '../services/entryInvoiceService';
import type { EntryListQuery } from '../types/models';

const DEFAULT_PAGE_SIZE = 12;

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export class EntryInvoiceController {
  constructor(private readonly entryInvoiceService: EntryInvoiceService) {}

  public metadata = (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      data: this.entryInvoiceService.getFormMetadata(),
    });
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = String(req.query.status ?? 'all').toLowerCase();
      const query: EntryListQuery = {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status:
          status === 'draft' || status === 'submitted' || status === 'all'
            ? (status as EntryListQuery['status'])
            : 'all',
        page: parsePositiveInteger(req.query.page, 1),
        pageSize: parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE),
      };

      res.status(200).json({
        success: true,
        data: await this.entryInvoiceService.listEntries(query),
      });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({
        success: true,
        data: await this.entryInvoiceService.getEntryById(String(req.params.entryId)),
      });
    } catch (error) {
      next(error);
    }
  };

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(201).json({
        success: true,
        data: await this.entryInvoiceService.createEntry(req.body),
      });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({
        success: true,
        data: await this.entryInvoiceService.updateEntry(String(req.params.entryId), req.body),
      });
    } catch (error) {
      next(error);
    }
  };

  public submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({
        success: true,
        data: await this.entryInvoiceService.submitEntry(String(req.params.entryId), req.body),
      });
    } catch (error) {
      next(error);
    }
  };

  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.entryInvoiceService.deleteEntry(String(req.params.entryId));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
