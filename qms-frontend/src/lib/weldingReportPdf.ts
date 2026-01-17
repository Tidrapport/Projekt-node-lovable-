import { WeldingReport, WeldingEntry } from '../types/weldingReport'

const loadPdfLib = async () => {
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js')
  return mod
}

const TEMPLATE_PATH = '/welding-template.pdf'

const fetchTemplate = async () => {
  const res = await fetch(TEMPLATE_PATH)
  if (!res.ok) {
    throw new Error('Could not load welding report template.')
  }
  return res.arrayBuffer()
}

const normalizeRows = (entries: WeldingEntry[]) => {
  const padded = [...entries]
  while (padded.length < 13) {
    padded.push({
      nr: padded.length + 1,
      date: '',
      location: '',
      switchImage: '',
      beforeMm: '',
      afterMm: '',
      temp: '',
      model: '',
      material: '',
      rail: '',
      workType: '',
      weldingMethod: '',
      additiveMaterial: '',
      batchNr: '',
      wpsNr: '',
    })
  }
  return padded
}

const buildPdfBytes = async (report: WeldingReport, companyName: string) => {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()
  const templateBytes = await fetchTemplate()
  const pdfDoc = await PDFDocument.load(templateBytes)
  const form = pdfDoc.getForm()
  form.getFields().forEach((field: any) => form.removeField(field))
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.getPages()[0]

  const draw = (
    text: string | number | null | undefined,
    x: number,
    y: number,
    opts: { size?: number; bold?: boolean } = {}
  ) => {
    page.drawText(String(text ?? ''), {
      x,
      y,
      size: opts.size ?? 9,
      font: opts.bold ? fontBold : font,
      color: rgb(0, 0, 0),
    })
  }

  draw(companyName, 80, 505, { bold: true, size: 9 })
  draw(report.own_ao_number || '', 280, 505, { bold: true, size: 9 })
  draw(report.customer_ao_number || '', 410, 505, { bold: true, size: 9 })
  draw(report.report_year || '', 280, 465, { bold: true, size: 9 })
  draw(report.report_month || '', 320, 465, { bold: true, size: 9 })

  draw(`${report.welder_name || ''} ${report.welder_id || ''}`, 80, 465, { bold: true, size: 9 })
  draw(report.bessy_anm_ofelia || '', 410, 465, { bold: true, size: 9 })

  const rows = normalizeRows(report.welding_entries || [])
  const rowY = [410, 385, 365, 345, 325, 305, 285, 265, 245, 225]
  const extraRowStep = 20

  const colX = {
    nr: 60,
    date: 80,
    location: 100,
    switchImage: 240,
    beforeMm: 280,
    afterMm: 305,
    temp: 340,
    model: 365,
    material: 410,
    rail: 485,
    workType: 535,
    weldingMethod: 590,
    additiveMaterial: 645,
    batchNr: 700,
    wpsNr: 760,
  }

  rows.forEach((entry, idx) => {
    const y =
      idx < rowY.length ? rowY[idx] : rowY[rowY.length - 1] - (idx - (rowY.length - 1)) * extraRowStep
    draw(entry.date || '', colX.date, y, { size: 7 })
    draw(entry.location || '', colX.location, y, { size: 7 })
    draw(entry.switchImage || '', colX.switchImage, y, { size: 7 })
    draw(entry.beforeMm || '', colX.beforeMm, y + 1, { size: 7 })
    draw(entry.afterMm || '', colX.afterMm, y, { size: 7 })
    draw(entry.temp || '', colX.temp, y, { size: 7 })
    draw(entry.model || '', colX.model, y, { size: 7 })
    draw(entry.material || '', colX.material, y, { size: 7 })
    draw(entry.rail || '', colX.rail, y, { size: 7 })
    draw(entry.workType || '', colX.workType, y, { size: 7 })
    draw(entry.weldingMethod || '', colX.weldingMethod, y, { size: 7 })
    draw(entry.additiveMaterial || '', colX.additiveMaterial, y, { size: 7 })
    draw(entry.batchNr || '', colX.batchNr, y, { size: 7 })
    draw(entry.wpsNr || '', colX.wpsNr, y, { size: 7 })
  })

  draw(report.welding_supervisor || '', 465, 205, { bold: true, size: 9 })
  draw(report.supervisor_phone || '', 465, 185, { bold: true, size: 9 })
  draw(report.deviations || '', 465, 165, { size: 9 })
  draw(report.comments || '', 365, 120, { size: 9 })

  const markXOffset = 12
  const mark = (cond: boolean | null | undefined, x: number, y: number) => {
    if (cond) draw('X', x + markXOffset, y, { bold: true, size: 11 })
  }
  mark(report.id_marked_weld, 200, 185)
  mark(report.geometry_control, 200, 165)
  mark(report.cleaned_workplace, 200, 145)
  mark(report.restored_rail_quantity, 200, 130)
  mark(report.welded_in_cold_climate, 200, 110)
  mark(report.ensured_gas_flow, 200, 90)
  mark(report.protected_cooling, 200, 70)

  return pdfDoc.save()
}

const createBlobUrl = (bytes: Uint8Array) => {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}

export const openWeldingReportPdf = async (report: WeldingReport, companyName: string) => {
  const pdfWindow = window.open('', '_blank', 'noopener')
  const bytes = await buildPdfBytes(report, companyName)
  const url = createBlobUrl(bytes)
  if (pdfWindow) {
    pdfWindow.location.href = url
  } else {
    window.location.assign(url)
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export const downloadWeldingReportPdf = async (report: WeldingReport, companyName: string) => {
  const bytes = await buildPdfBytes(report, companyName)
  const url = createBlobUrl(bytes)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `svetsrapport_${report.id || 'rapport'}.pdf`
  anchor.click()
  URL.revokeObjectURL(url)
}
