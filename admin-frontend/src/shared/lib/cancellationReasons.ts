export interface CancellationReason {
  value: string
  label: string
}

export const CANCELLATION_REASONS: CancellationReason[] = [
  { value: 'accidentally_created',  label: 'Created by mistake'                        },
  { value: 'client_no_care_needed', label: 'Client does not need care today'           },
  { value: 'client_hospitalized',   label: 'Client is hospitalized'                    },
  { value: 'worker_unavailable',    label: 'Worker is unavailable / called in sick'    },
  { value: 'scheduling_conflict',   label: 'Scheduling conflict'                       },
  { value: 'care_plan_ended',       label: "Client's care plan has ended"              },
  { value: 'public_holiday',        label: 'Public holiday'                            },
  { value: 'other',                 label: 'Other'                                     },
]
