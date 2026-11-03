import { AssignmentsPanel } from '@/features/assignments/components/AssignmentsPanel'
import { useWorkerProfileContext } from '../hooks/WorkerProfileContext'

export function WorkerAssignments() {
  const { worker } = useWorkerProfileContext()
  return (
    <div className="wp-assignments">
      <div className="wp-section-heading">
        <h2>The people {worker.first_name} supports.</h2>
      </div>
      <AssignmentsPanel workerId={worker.id} />
    </div>
  )
}
