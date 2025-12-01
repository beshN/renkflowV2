import { DocumentFile } from "./types";

const GENERIC_PDF_URL = "https://lh3.googleusercontent.com/aida-public/AB6AXuDkHZwpQQ39NAq2aue5JlRvhLj6tUPkxj8ad2ukgPah1XUjth_uyxVCwDFIbFt4LahTrdM6noYMQyc2oaiwouJPzqIOHT4CDXIlUvqrzhLUBo0mJo8u-Pt-ZLP748bc791YDjOEp-7C-1CGuyfvVFR_KCtPIpL0mGgSarbnYEK70gZmliMGE405R-ylkK-liYv72CXHM7usuyGDKH03Sw1a07qOCLvcJ2FNsJ4J7fL2kZtKjZqpBEThcqX8HUk9rcnFEcP53bvSoAI_";
const CONTRACT_URL = "https://lh3.googleusercontent.com/aida-public/AB6AXuC0YhUOQLUvkgA93_MBF_aL4Cp1-J0_KDiVkz6IQGVkJLE2SXDx8TG399EsEDhnd3OEBE_0-t_6nph-TTykaweUu5m0gqj1GKlN4Z4Kf7pfrK6nmvKMVBRW4GEd6n00lkrz6rDLXkOF7x-XKOqTID9vYqfyQlL5ag99h3Qj-HiBcqIFj0__LXkao61Usc6et_wPp9OR6T3gEgkVOzwZMR6sRXFfEoWpCb2dOK0nlnx3jBRwYwQRx4VOJe9IpwiMkimcFBCmqk2COA0U";

export const MOCK_FILES: DocumentFile[] = [
  {
    id: "renk-1",
    name: "Renk_Kepenk_Sistemleri.pdf",
    size: "1.8 MB",
    type: "pdf",
    pageCount: 3,
    thumbnailUrl: GENERIC_PDF_URL, 
    pages: [
      GENERIC_PDF_URL, 
      GENERIC_PDF_URL, 
      GENERIC_PDF_URL
    ]
  },
  {
    id: "real-pdf",
    name: "Real_Sample_Doc.pdf",
    size: "45 KB",
    type: "pdf",
    pageCount: 1,
    thumbnailUrl: GENERIC_PDF_URL,
    // CORS-friendly public PDF for testing
    pages: ["https://pdfobject.com/pdf/sample.pdf"]
  },
  {
    id: "broken-pdf",
    name: "Bozuk Dosya (TEST).pdf",
    size: "0 KB",
    type: "pdf",
    pageCount: 1,
    thumbnailUrl: GENERIC_PDF_URL,
    // This triggers the error overlay via error handler in PDFViewer
    pages: ["https://invalid-url-that-fails.com/doc.pdf"]
  },
  {
    id: "2",
    name: "Contract_V3.pdf",
    size: "1.2 MB",
    type: "pdf",
    pageCount: 6,
    thumbnailUrl: CONTRACT_URL,
    pages: [CONTRACT_URL, CONTRACT_URL, CONTRACT_URL, CONTRACT_URL, CONTRACT_URL, CONTRACT_URL],
    searchUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCfforcI125fd1VzpqdjaDYhuulfevU-mBeey8ApKGBCdHHN6a6XOYOErtrZObsxFXMy1MuVWLM0x99gloib1CQ16qBHmFch0qUBYWtG0rwYuChHhfvlYyCEDrDa_IUFz2dDPAtrJ47JGrZ7tJGfvz9Jv8l8NpAX8EJC8_OBWg1Fhg9dyjmxUgIjxFSBqG9WiS0ISIhGHZV3NVsA_wqI5q1EbV2kzxDpzcwEYrLshdyEoCtdpvfjpk4HN0oIpf-T_xFQkukcMZYK5I-"
  }
];
