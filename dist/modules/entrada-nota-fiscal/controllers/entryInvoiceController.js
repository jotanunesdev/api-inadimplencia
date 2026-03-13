"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryInvoiceController = void 0;
const DEFAULT_PAGE_SIZE = 12;
function parsePositiveInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}
class EntryInvoiceController {
    entryInvoiceService;
    constructor(entryInvoiceService) {
        this.entryInvoiceService = entryInvoiceService;
    }
    metadata = (_req, res) => {
        res.status(200).json({
            success: true,
            data: this.entryInvoiceService.getFormMetadata(),
        });
    };
    list = async (req, res, next) => {
        try {
            const status = String(req.query.status ?? 'all').toLowerCase();
            const query = {
                search: typeof req.query.search === 'string' ? req.query.search : undefined,
                status: status === 'draft' ||
                    status === 'pending_analysis' ||
                    status === 'approved' ||
                    status === 'rejected' ||
                    status === 'submitted' ||
                    status === 'all'
                    ? status
                    : 'all',
                page: parsePositiveInteger(req.query.page, 1),
                pageSize: parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE),
            };
            res.status(200).json({
                success: true,
                data: await this.entryInvoiceService.listEntries(query),
            });
        }
        catch (error) {
            next(error);
        }
    };
    getById = async (req, res, next) => {
        try {
            res.status(200).json({
                success: true,
                data: await this.entryInvoiceService.getEntryById(String(req.params.entryId)),
            });
        }
        catch (error) {
            next(error);
        }
    };
    create = async (req, res, next) => {
        try {
            res.status(201).json({
                success: true,
                data: await this.entryInvoiceService.createEntry(req.body),
            });
        }
        catch (error) {
            next(error);
        }
    };
    update = async (req, res, next) => {
        try {
            res.status(200).json({
                success: true,
                data: await this.entryInvoiceService.updateEntry(String(req.params.entryId), req.body),
            });
        }
        catch (error) {
            next(error);
        }
    };
    submit = async (req, res, next) => {
        try {
            res.status(200).json({
                success: true,
                data: await this.entryInvoiceService.submitEntry(String(req.params.entryId), req.body),
            });
        }
        catch (error) {
            next(error);
        }
    };
    approve = async (req, res, next) => {
        try {
            res.status(200).json({
                success: true,
                data: await this.entryInvoiceService.approveEntry(String(req.params.entryId), req.body),
            });
        }
        catch (error) {
            next(error);
        }
    };
    reject = async (req, res, next) => {
        try {
            res.status(200).json({
                success: true,
                data: await this.entryInvoiceService.rejectEntry(String(req.params.entryId), req.body),
            });
        }
        catch (error) {
            next(error);
        }
    };
    remove = async (req, res, next) => {
        try {
            await this.entryInvoiceService.deleteEntry(String(req.params.entryId));
            res.status(204).send();
        }
        catch (error) {
            next(error);
        }
    };
}
exports.EntryInvoiceController = EntryInvoiceController;
