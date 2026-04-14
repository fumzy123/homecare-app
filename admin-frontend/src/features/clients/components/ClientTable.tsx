import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { type Client, SERVICE_TYPE_LABELS } from '@/features/clients/api'
import { ClientStatusBadge } from '@/features/clients/components/ClientStatusBadge'

const columnHelper = createColumnHelper<Client>()

const columns = [
  columnHelper.display({
    id: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span className="font-medium text-gray-900">
        {row.original.first_name} {row.original.last_name}
      </span>
    ),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <ClientStatusBadge status={getValue()} />,
  }),
  columnHelper.accessor('service_type', {
    header: 'Service',
    cell: ({ getValue }) => (
      <span className="text-gray-600">{SERVICE_TYPE_LABELS[getValue()]}</span>
    ),
  }),
  columnHelper.display({
    id: 'location',
    header: 'Location',
    cell: ({ row }) => (
      <span className="text-gray-600">
        {row.original.city}, {row.original.province}
      </span>
    ),
  }),
  columnHelper.accessor('phone_number', {
    header: 'Phone',
    cell: ({ getValue }) => (
      <span className="text-gray-600">{getValue() ?? '—'}</span>
    ),
  }),
  columnHelper.accessor('care_start_date', {
    header: 'Care Start',
    cell: ({ getValue }) => (
      <span className="text-gray-600">
        {new Date(getValue()).toLocaleDateString('en-CA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    ),
  }),
  columnHelper.display({
    id: 'worker',
    header: 'Worker',
    cell: ({ row }) => (
      <span className="text-gray-600">
        {row.original.assigned_worker
          ? `${row.original.assigned_worker.first_name} ${row.original.assigned_worker.last_name}`
          : '—'}
      </span>
    ),
  }),
]

interface ClientTableProps {
  clients: Client[]
  globalFilter: string
}

export function ClientTable({ clients, globalFilter }: ClientTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: clients,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 select-none"
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <span className="text-gray-400">
                        {header.column.getIsSorted() === 'asc' ? (
                          <ChevronUp size={13} />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ChevronDown size={13} />
                        ) : (
                          <ChevronsUpDown size={13} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                No clients match your search.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
