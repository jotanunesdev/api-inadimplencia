"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDossieSelectableCoursesByCpf = listDossieSelectableCoursesByCpf;
exports.generateDossiePdfForCpf = generateDossiePdfForCpf;
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const sharp_1 = __importDefault(require("sharp"));
const docx_1 = require("docx");
const sharePointService_1 = require("./sharePointService");
const dossieModel_1 = require("../models/dossieModel");
const httpError_1 = require("../utils/httpError");
const DOSSIE_OUTPUT_FOLDER = "dossies";
const DOSSIE_TEMP_FOLDER = "dossies/_tmp";
const DOSSIE_TEMPLATE_FOLDER = "dossie";
// Bibliotecas sem typings completos para o formato usado pelo template DOCX.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require("pizzip");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Docxtemplater = require("docxtemplater");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ImageModule = require("docxtemplater-image-module-free");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function sanitizeFileName(name) {
    return name
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function formatDateTime(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return "-";
    }
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
    }).format(value);
}
function formatIssueDate(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return "-";
    }
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
    }).format(value);
}
function formatScore(value) {
    if (!Number.isFinite(value))
        return "-";
    return value.toFixed(2);
}
function parseBase64Image(base64Data) {
    const trimmed = base64Data.trim();
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
    const payload = (match ? match[2] : trimmed).replace(/\s+/g, "");
    if (!payload)
        return null;
    try {
        return Buffer.from(payload, "base64");
    }
    catch {
        return null;
    }
}
async function resolveNormalizedFaceImageBufferFromRefs(params) {
    const normalizeForWord = async (buffer) => {
        if (!buffer || !buffer.length)
            return null;
        try {
            return await (0, sharp_1.default)(buffer)
                .rotate()
                .resize(600, 600, { fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer();
        }
        catch (error) {
            console.warn("[Dossie] Falha ao normalizar foto facial para JPEG:", error);
            return buffer;
        }
    };
    const fotoUrl = params.fotoUrl?.trim();
    if (fotoUrl) {
        try {
            const downloaded = await (0, sharePointService_1.downloadSharePointFileByUrl)(fotoUrl);
            const normalized = await normalizeForWord(downloaded);
            if (normalized?.length) {
                return normalized;
            }
        }
        catch (error) {
            console.warn("[Dossie] Falha ao baixar foto facial do SharePoint:", error);
        }
    }
    const fotoBase64 = params.fotoBase64?.trim();
    if (fotoBase64) {
        const parsed = parseBase64Image(fotoBase64);
        return normalizeForWord(parsed);
    }
    return null;
}
async function resolveFaceImageBuffer(data) {
    return resolveNormalizedFaceImageBufferFromRefs({
        fotoUrl: data.identificacao.fotoUrl,
        fotoBase64: data.identificacao.fotoBase64,
    });
}
async function resolveTrainingItemFaceImageBuffer(item) {
    return resolveNormalizedFaceImageBufferFromRefs({
        fotoUrl: item.fotoConfirmacaoUrl,
        fotoBase64: item.fotoConfirmacaoBase64,
    });
}
async function buildTemplateLoopItemsWithPhotos(items, kind, omitItemFaces) {
    const faceBuffers = omitItemFaces
        ? Array.from({ length: items.length }, () => null)
        : await Promise.all(items.map((item) => resolveTrainingItemFaceImageBuffer(item)));
    return items.map((item, index) => {
        const faceBuffer = faceBuffers[index];
        const fotoConfirmacao = faceBuffer?.length
            ? `data:image/jpeg;base64,${faceBuffer.toString("base64")}`
            : null;
        const baseItem = {
            DataHora: formatDateTime(item.dataHora),
            Treinamento: item.treinamento,
            NotaProva: formatScore(item.notaProva),
            FotoConfirmacao: fotoConfirmacao,
        };
        return kind === "norma"
            ? { ...baseItem, Norma: item.itemNome }
            : { ...baseItem, Procedimento: item.itemNome };
    });
}
async function buildTemplateContext(data, faceImageBuffer, meta) {
    const fotoForTemplate = faceImageBuffer?.length
        ? `data:image/jpeg;base64,${faceImageBuffer.toString("base64")}`
        : null;
    const emissor = (meta?.usuarioEmissor ?? "").trim() || "Sistema";
    const dataEmissao = meta?.dataEmissao ?? new Date();
    const obra = (meta?.obra ?? "").trim() || "-";
    const setorObra = (meta?.setorObra ?? "").trim() || "-";
    const [normasTreinadas, procedimentosTreinados] = await Promise.all([
        buildTemplateLoopItemsWithPhotos(data.normasTreinadas, "norma", Boolean(meta?.omitFace)),
        buildTemplateLoopItemsWithPhotos(data.procedimentosTreinados, "procedimento", Boolean(meta?.omitFace)),
    ]);
    return {
        NomeCompleto: data.identificacao.nomeCompleto || "-",
        Funcao: data.identificacao.funcao || "-",
        CPF: data.identificacao.cpf || "-",
        DataEmissao: formatIssueDate(dataEmissao),
        UsuarioEmissor: emissor,
        Obra: obra,
        SetorObra: setorObra,
        // Com delimitadores {{ }}, use `{{%Foto}}` no template.
        // Para foto dentro dos loops use `{{%FotoConfirmacao}}`.
        Foto: fotoForTemplate,
        NormasTreinadas: normasTreinadas,
        ProcedimentosTreinados: procedimentosTreinados,
    };
}
async function loadDossieTemplateDocxBuffer() {
    const items = await (0, sharePointService_1.listSharePointFolderChildren)(DOSSIE_TEMPLATE_FOLDER);
    const candidates = items
        .filter((item) => item.file)
        .filter((item) => item.name.toLowerCase().endsWith(".docx"))
        .filter((item) => !item.name.startsWith("~$"))
        .sort((a, b) => {
        const da = new Date(a.lastModifiedDateTime ?? 0).getTime();
        const db = new Date(b.lastModifiedDateTime ?? 0).getTime();
        return db - da;
    });
    if (!candidates.length) {
        throw new Error(`Nenhum template .docx encontrado em SharePoint na pasta '${DOSSIE_TEMPLATE_FOLDER}'`);
    }
    const preferred = candidates.find((item) => item.name.toLowerCase().includes("modelo")) ??
        candidates[0];
    const fullPath = (0, sharePointService_1.buildSharePointFilePath)({
        relativeFolderPath: DOSSIE_TEMPLATE_FOLDER,
        fileName: preferred.name,
    }).fullPath;
    console.log("[Dossie] Template Word selecionado:", {
        nome: preferred.name,
        fullPath,
        alteradoEm: preferred.lastModifiedDateTime ?? null,
    });
    return (0, sharePointService_1.downloadSharePointFileContentByPath)({ fullPath });
}
async function buildDossieDocxBufferFromTemplate(data, options) {
    const [templateBuffer, faceImageBuffer] = await Promise.all([
        loadDossieTemplateDocxBuffer(),
        options?.omitFace ? Promise.resolve(null) : resolveFaceImageBuffer(data),
    ]);
    const zip = new PizZip(templateBuffer);
    const imageModule = new ImageModule({
        centered: false,
        fileType: "docx",
        getImage(tagValue) {
            if (!tagValue) {
                // Transparente 1x1 PNG em base64 para placeholder opcional
                return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZLZQAAAAASUVORK5CYII=", "base64");
            }
            if (Buffer.isBuffer(tagValue)) {
                return tagValue;
            }
            if (typeof tagValue === "string") {
                return parseBase64Image(tagValue) ?? Buffer.from(tagValue);
            }
            throw new Error("Formato de imagem invalido para placeholder Foto");
        },
        getSize() {
            return [120, 120];
        },
    });
    // O módulo open-source de imagem é antigo e é mais estável no fluxo legado
    // (attachModule/loadZip/setOptions) do que no construtor com modules:[...].
    const doc = new Docxtemplater();
    doc.attachModule(imageModule);
    doc.loadZip(zip);
    doc.setOptions({
        delimiters: {
            start: "{{",
            end: "}}",
        },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter() {
            return "";
        },
    });
    try {
        const templateContext = await buildTemplateContext(data, faceImageBuffer, {
            ...options,
            omitFace: Boolean(options?.omitFace),
        });
        doc.render(templateContext);
    }
    catch (error) {
        const details = error && typeof error === "object"
            ? JSON.stringify({
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                properties: "properties" in error
                    ? error.properties
                    : undefined,
            }, null, 2)
            : String(error);
        throw new Error(`[DossieTemplate] Falha ao renderizar template DOCX: ${details}`);
    }
    return doc.getZip().generate({ type: "nodebuffer" });
}
function isOfficeConversionTransientError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    return (normalized.includes("(406)") ||
        normalized.includes("cannotopenfile") ||
        normalized.includes("error from office service") ||
        normalized.includes("notsupported"));
}
function cellText(text, opts) {
    return new docx_1.TableCell({
        width: { size: 30, type: docx_1.WidthType.PERCENTAGE },
        children: [
            new docx_1.Paragraph({
                children: [
                    new docx_1.TextRun({
                        text,
                        bold: opts?.bold ?? false,
                    }),
                ],
            }),
        ],
    });
}
function valueCell(text) {
    return new docx_1.TableCell({
        width: { size: 70, type: docx_1.WidthType.PERCENTAGE },
        children: [new docx_1.Paragraph(text || "-")],
    });
}
function valueImageCell(buffer) {
    return new docx_1.TableCell({
        width: { size: 70, type: docx_1.WidthType.PERCENTAGE },
        children: [
            buffer?.length
                ? new docx_1.Paragraph({
                    children: [
                        new docx_1.ImageRun({
                            data: buffer,
                            transformation: { width: 90, height: 90 },
                        }),
                    ],
                })
                : new docx_1.Paragraph({
                    children: [new docx_1.TextRun({ text: "Sem foto de confirmacao", italics: true })],
                }),
        ],
    });
}
async function buildSectionRows(items, labelKey, options) {
    if (!items.length) {
        return [
            new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({
                        columnSpan: 2,
                        children: [new docx_1.Paragraph("Nenhum registro encontrado.")],
                    }),
                ],
            }),
        ];
    }
    const rows = [];
    for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        const faceConfirmacaoBuffer = options?.omitFace
            ? null
            : await resolveTrainingItemFaceImageBuffer(item);
        rows.push(new docx_1.TableRow({
            children: [cellText(`${labelKey}:`, { bold: true }), valueCell(item.itemNome)],
        }), new docx_1.TableRow({
            children: [cellText("Data e Hora:", { bold: true }), valueCell(formatDateTime(item.dataHora))],
        }), new docx_1.TableRow({
            children: [cellText("Nome Treinamento:", { bold: true }), valueCell(item.treinamento)],
        }), new docx_1.TableRow({
            children: [cellText("Nota da Prova:", { bold: true }), valueCell(formatScore(item.notaProva))],
        }), new docx_1.TableRow({
            children: [cellText("Foto Confirmacao:", { bold: true }), valueImageCell(faceConfirmacaoBuffer)],
        }), new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    columnSpan: 2,
                    borders: {
                        top: { style: docx_1.BorderStyle.SINGLE, color: "D9D9D9", size: 4 },
                        bottom: { style: docx_1.BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        left: { style: docx_1.BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        right: { style: docx_1.BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    children: [new docx_1.Paragraph("")],
                }),
            ],
        }));
    }
    return rows;
}
function buildIdentificacaoTable(params) {
    const textRows = [
        new docx_1.Paragraph({
            children: [
                new docx_1.TextRun({ text: "Nome do Colaborador: ", bold: true }),
                new docx_1.TextRun(params.nomeCompleto || "-"),
            ],
            spacing: { after: 160 },
        }),
        new docx_1.Paragraph({
            children: [
                new docx_1.TextRun({ text: "Funcao: ", bold: true }),
                new docx_1.TextRun(params.funcao || "-"),
            ],
            spacing: { after: 160 },
        }),
        new docx_1.Paragraph({
            children: [
                new docx_1.TextRun({ text: "CPF: ", bold: true }),
                new docx_1.TextRun(params.cpf || "-"),
            ],
            spacing: { after: 160 },
        }),
        new docx_1.Paragraph({
            children: [
                new docx_1.TextRun({ text: "Obra: ", bold: true }),
                new docx_1.TextRun(params.obra?.trim() || "-"),
            ],
            spacing: { after: 160 },
        }),
        new docx_1.Paragraph({
            children: [
                new docx_1.TextRun({ text: "Setor da Obra: ", bold: true }),
                new docx_1.TextRun(params.setorObra?.trim() || "-"),
            ],
            spacing: { after: 160 },
        }),
        new docx_1.Paragraph({
            children: [
                new docx_1.TextRun({ text: "Data Emissao: ", bold: true }),
                new docx_1.TextRun(params.dataEmissao || "-"),
            ],
            spacing: { after: 160 },
        }),
        new docx_1.Paragraph({
            children: [
                new docx_1.TextRun({ text: "Usuario Emissor: ", bold: true }),
                new docx_1.TextRun(params.usuarioEmissor || "Sistema"),
            ],
        }),
    ];
    const faceParagraph = params.faceImageBuffer
        ? new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            children: [
                new docx_1.ImageRun({
                    data: params.faceImageBuffer,
                    transformation: { width: 120, height: 120 },
                }),
            ],
        })
        : new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            children: [new docx_1.TextRun({ text: "Sem foto facial", italics: true })],
        });
    return new docx_1.Table({
        width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
        borders: {
            top: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
            bottom: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
            left: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
            right: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
            insideHorizontal: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
            insideVertical: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
        },
        rows: [
            new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({
                        width: { size: 75, type: docx_1.WidthType.PERCENTAGE },
                        children: textRows,
                    }),
                    new docx_1.TableCell({
                        width: { size: 25, type: docx_1.WidthType.PERCENTAGE },
                        children: [faceParagraph],
                    }),
                ],
            }),
        ],
    });
}
async function buildDossieDocxBuffer(data, options) {
    try {
        return await buildDossieDocxBufferFromTemplate(data, options);
    }
    catch (error) {
        console.warn("[Dossie] Template Word do SharePoint nao utilizado. Aplicando layout programatico.", error);
    }
    const faceImageBuffer = options?.omitFace ? null : await resolveFaceImageBuffer(data);
    const sectionChildren = [
        new docx_1.Paragraph({
            text: "Dossie do Colaborador",
            heading: docx_1.HeadingLevel.TITLE,
            spacing: { after: 240 },
        }),
        new docx_1.Paragraph({
            text: "Identificacao",
            heading: docx_1.HeadingLevel.HEADING_1,
            spacing: { before: 120, after: 180 },
        }),
        buildIdentificacaoTable({
            nomeCompleto: data.identificacao.nomeCompleto,
            funcao: data.identificacao.funcao,
            cpf: data.identificacao.cpf,
            obra: options?.obra ?? null,
            setorObra: options?.setorObra ?? null,
            faceImageBuffer,
            dataEmissao: formatIssueDate(options?.dataEmissao ?? new Date()),
            usuarioEmissor: (options?.usuarioEmissor ?? "").trim() || "Sistema",
        }),
        new docx_1.Paragraph({
            text: "Normas Treinadas",
            heading: docx_1.HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 180 },
        }),
        new docx_1.Table({
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
                bottom: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
                left: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
                right: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
                insideHorizontal: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
                insideVertical: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
            },
            rows: await buildSectionRows(data.normasTreinadas, "Norma", {
                omitFace: Boolean(options?.omitFace),
            }),
        }),
        new docx_1.Paragraph({
            text: "Procedimentos Treinados",
            heading: docx_1.HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 180 },
        }),
        new docx_1.Table({
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
                bottom: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
                left: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
                right: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
                insideHorizontal: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
                insideVertical: { style: docx_1.BorderStyle.SINGLE, color: "E1E5EA", size: 4 },
            },
            rows: await buildSectionRows(data.procedimentosTreinados, "Procedimento", {
                omitFace: Boolean(options?.omitFace),
            }),
        }),
    ];
    const sections = [
        {
            properties: {},
            children: sectionChildren,
        },
    ];
    const document = new docx_1.Document({ sections });
    return docx_1.Packer.toBuffer(document);
}
async function writeTempFile(buffer, extension) {
    const tempFilePath = path_1.default.join(os_1.default.tmpdir(), `dossie-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`);
    await promises_1.default.writeFile(tempFilePath, buffer);
    return tempFilePath;
}
function buildCourseSelectionKey(selection) {
    return `${selection.tipo}:${selection.itemId}:${selection.trilhaId}`;
}
function filterDossieItemsBySelection(items, tipo, allowedKeys) {
    if (!allowedKeys.size)
        return items;
    return items.filter((item) => allowedKeys.has(buildCourseSelectionKey({
        tipo,
        itemId: item.itemId,
        trilhaId: item.trilhaId,
    })));
}
function filterDossieDataBySelectedCourses(data, selectedCourses) {
    if (!selectedCourses?.length)
        return data;
    const normalizedSelections = selectedCourses
        .filter((item) => item && (item.tipo === "norma" || item.tipo === "procedimento"))
        .map((item) => ({
        tipo: item.tipo,
        itemId: String(item.itemId ?? "").trim(),
        trilhaId: String(item.trilhaId ?? "").trim(),
    }))
        .filter((item) => item.itemId && item.trilhaId);
    if (!normalizedSelections.length)
        return data;
    const allowedKeys = new Set(normalizedSelections.map(buildCourseSelectionKey));
    return {
        ...data,
        normasTreinadas: filterDossieItemsBySelection(data.normasTreinadas, "norma", allowedKeys),
        procedimentosTreinados: filterDossieItemsBySelection(data.procedimentosTreinados, "procedimento", allowedKeys),
    };
}
async function listDossieSelectableCoursesByCpf(cpf) {
    const data = await (0, dossieModel_1.getDossieDataByCpf)(cpf);
    if (!data) {
        throw new httpError_1.HttpError(404, "Colaborador nao encontrado");
    }
    const mapItems = (tipo, items) => items.map((item) => ({
        selectionKey: buildCourseSelectionKey({
            tipo,
            itemId: item.itemId,
            trilhaId: item.trilhaId,
        }),
        tipo,
        itemId: item.itemId,
        itemNome: item.itemNome,
        trilhaId: item.trilhaId,
        treinamento: item.treinamento,
        dataHora: item.dataHora.toISOString(),
        notaProva: item.notaProva,
    }));
    return [...mapItems("norma", data.normasTreinadas), ...mapItems("procedimento", data.procedimentosTreinados)]
        .sort((a, b) => {
        const da = new Date(a.dataHora).getTime();
        const db = new Date(b.dataHora).getTime();
        if (da !== db)
            return db - da;
        return a.treinamento.localeCompare(b.treinamento, "pt-BR");
    });
}
async function generateDossiePdfForCpf(cpf, options) {
    if (!(0, sharePointService_1.isSharePointEnabled)()) {
        throw new httpError_1.HttpError(400, "SharePoint nao habilitado para gerar dossie");
    }
    const rawData = await (0, dossieModel_1.getDossieDataByCpf)(cpf);
    if (!rawData) {
        throw new httpError_1.HttpError(404, "Colaborador nao encontrado");
    }
    const data = filterDossieDataBySelectedCourses(rawData, options?.cursosSelecionados);
    if (!data.normasTreinadas.length && !data.procedimentosTreinados.length) {
        throw new httpError_1.HttpError(400, "Colaborador nao possui treinamentos validos para o dossie");
    }
    const baseName = sanitizeFileName(data.identificacao.nomeCompleto || cpf) || cpf;
    const pdfFileName = `${baseName}.pdf`;
    const generatePdfBufferFromDocx = async (docxBuffer) => {
        const docxTempFileName = `${baseName}-${(0, crypto_1.randomUUID)()}.docx`;
        const tempDocxLocalPath = await writeTempFile(docxBuffer, ".docx");
        let tempDocxRemoteFullPath = null;
        try {
            await (0, sharePointService_1.ensureSharePointFolder)(DOSSIE_TEMP_FOLDER);
            const docxRemote = (0, sharePointService_1.buildSharePointFilePath)({
                relativeFolderPath: DOSSIE_TEMP_FOLDER,
                fileName: docxTempFileName,
            });
            tempDocxRemoteFullPath = docxRemote.fullPath;
            const uploadedDocx = await (0, sharePointService_1.uploadFileToSharePoint)({
                tempFilePath: tempDocxLocalPath,
                relativeFolderPath: DOSSIE_TEMP_FOLDER,
                fileName: docxTempFileName,
                contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });
            let lastError = null;
            for (const delayMs of [1000, 2500, 5000]) {
                try {
                    return await (0, sharePointService_1.downloadSharePointFileContentByItemId)({
                        itemId: uploadedDocx.itemId,
                        format: "pdf",
                    });
                }
                catch (error) {
                    lastError = error;
                    if (!isOfficeConversionTransientError(error)) {
                        throw error;
                    }
                    await sleep(delayMs);
                }
            }
            // Fallback por path (alguns tenants respondem melhor por path apos indexacao)
            try {
                return await (0, sharePointService_1.downloadSharePointFileContentByPath)({
                    fullPath: tempDocxRemoteFullPath,
                    format: "pdf",
                });
            }
            catch (error) {
                if (lastError) {
                    throw lastError;
                }
                throw error;
            }
        }
        finally {
            if (tempDocxRemoteFullPath) {
                await (0, sharePointService_1.deleteSharePointFileByPath)(tempDocxRemoteFullPath).catch(() => undefined);
            }
            await promises_1.default.unlink(tempDocxLocalPath).catch(() => undefined);
        }
    };
    let pdfBuffer;
    try {
        const docxBuffer = await buildDossieDocxBuffer(data, options);
        pdfBuffer = await generatePdfBufferFromDocx(docxBuffer);
    }
    catch (error) {
        if (!isOfficeConversionTransientError(error)) {
            throw error;
        }
        // Fallback: alguns formatos de imagem facial podem quebrar a conversao do Office.
        console.warn("[Dossie] Conversao DOCX->PDF falhou. Tentando novamente sem foto facial.", error);
        const docxWithoutFace = await buildDossieDocxBuffer(data, {
            ...options,
            omitFace: true,
        });
        pdfBuffer = await generatePdfBufferFromDocx(docxWithoutFace);
    }
    await (0, sharePointService_1.ensureSharePointFolder)(DOSSIE_OUTPUT_FOLDER);
    const tempPdfLocalPath = await writeTempFile(pdfBuffer, ".pdf");
    try {
        const uploadedPdf = await (0, sharePointService_1.uploadFileToSharePoint)({
            tempFilePath: tempPdfLocalPath,
            relativeFolderPath: DOSSIE_OUTPUT_FOLDER,
            fileName: pdfFileName,
            contentType: "application/pdf",
        });
        return {
            cpf: data.identificacao.cpf,
            nomeColaborador: data.identificacao.nomeCompleto,
            fileName: pdfFileName,
            webUrl: uploadedPdf.webUrl,
        };
    }
    finally {
        await promises_1.default.unlink(tempPdfLocalPath).catch(() => undefined);
    }
}
