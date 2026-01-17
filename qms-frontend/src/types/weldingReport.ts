export interface WeldingEntry {
  nr: number
  date: string
  location: string
  switchImage: string
  beforeMm: string
  afterMm: string
  temp: string
  model: string
  material: string
  rail: string
  workType: string
  weldingMethod: string
  additiveMaterial: string
  batchNr: string
  wpsNr: string
}

export interface WeldingReport {
  id: string
  user_id: string
  company_id: string | null
  created_at: string
  updated_at: string
  report_date: string
  own_ao_number: string | null
  customer_ao_number: string | null
  welder_name: string
  welder_id: string
  report_year: number
  report_month: number
  bessy_anm_ofelia: string | null
  welding_entries: WeldingEntry[]
  id_marked_weld: boolean
  geometry_control: boolean
  cleaned_workplace: boolean
  restored_rail_quantity: boolean
  welded_in_cold_climate: boolean
  ensured_gas_flow: boolean
  protected_cooling: boolean
  welding_supervisor: string | null
  supervisor_phone: string | null
  deviations: string | null
  comments: string | null
  attested_at?: string | null
  attested_by?: string | null
  attested_by_name?: string | null
  attested?: boolean
  profiles?: {
    full_name?: string | null
  } | null
}
