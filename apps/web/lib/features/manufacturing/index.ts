import { calculateRectangularFrameProfileMeters, calculateScrapWeight } from './calculations';
import { createBom, explodeBom } from './bom.service';
import { reviewExtraction, saveExtractionDraft } from './document-extraction.service';
import { getStockBalances, postStockEntry, reverseStockEntry } from './inventory.service';
import { completeProductionRun, createProductionWorkOrder, transferWorkOrderMaterials } from './manufacturing.service';
import { submitGoodsReceipt } from './procurement.service';
import { releaseWorkOrderReservation, reserveWorkOrderMaterials } from './reservation.service';

export const InventoryService = { getStockBalances, postStockEntry, reverseStockEntry };
export const ReservationService = { reserveWorkOrderMaterials, releaseWorkOrderReservation };
export const ProcurementService = { submitGoodsReceipt };
export const BomService = { createBom, explodeBom };
export const ManufacturingService = {
  createProductionWorkOrder,
  transferWorkOrderMaterials,
  completeProductionRun,
};
export const ProfileMaterialCalculator = { calculateRectangularFrameProfileMeters };
export const ScrapService = { calculateScrapWeight };
export const DocumentExtractionService = { saveExtractionDraft, reviewExtraction };

export * from './types';
