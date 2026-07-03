import { use } from "react";

export default function AdminEmployeeDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <div>Employee Details: {id}</div>;
}
