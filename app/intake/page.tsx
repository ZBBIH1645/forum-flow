import { IntakeForm } from "@/components/intake-form";

export const metadata = {
  title: "New Member Intake · Forum Placement Dashboard",
  description: "Tell us about yourself so the placement chair can match you with the right Forum."
};

export default function IntakePage() {
  return <IntakeForm />;
}
