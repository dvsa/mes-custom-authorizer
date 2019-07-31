import { EmployeeIdKey } from './AdJwtVerifier';

const getEmployeeIdKey = (): EmployeeIdKey => process.env.EMPLOYEE_ID_EXT_KEY as EmployeeIdKey;

export default getEmployeeIdKey;
