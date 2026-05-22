import CRUDPage from '../components/CRUDPage'
import ResetPasswordButton from '../components/ResetPasswordButton'

export default function Teachers() {
  return (
    <CRUDPage
      title="Guru"
      endpoint="teachers"
      columns={[
        { key: 'nip', label: 'NIP' },
        { key: 'name', label: 'Nama', render: (_, row) => row.user?.name || '-' },
        { key: 'email', label: 'Email', render: (_, row) => row.user?.email || '-' },
      ]}
      formFields={[
        { key: 'name', label: 'Nama Lengkap' },
        { key: 'email', label: 'Email' },
        { key: 'nip', label: 'NIP' },
        { key: 'phone', label: 'Telepon' },
      ]}
      rowExtraActions={(row) =>
        row.user?.id ? (
          <ResetPasswordButton
            userId={row.user.id}
            userName={row.user.name || 'Guru'}
          />
        ) : null
      }
    />
  )
}
